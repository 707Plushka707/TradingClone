from __future__ import print_function, absolute_import, unicode_literals

import time
try:
    from Queue import Empty
except ImportError:
    from queue import Empty

from multiprocessing import Process, cpu_count, Manager
import logging
import traceback

from django import db
from django.conf import settings
from django.core.cache import caches
from elasticsearch_dsl import connections

connections.create_connection(hosts=['localhost:8000'], timeout=20)


loggly = logging.getLogger('loggly')


class Timer(object):

    """ Simple class for timing code blocks
    """
    def __init__(self):
        self.start_time = time.time()

    def done(self):
        end_time = time.time()
        return int(end_time - self.start_time)


def close_service_connections():
    """ Close all connections before we spawn our processes
    This function should only be used when writing multithreaded scripts where connections need to manually
    opened and closed so that threads don't reuse the same connection
    https://stackoverflow.com/questions/8242837/django-multiprocessing-and-database-connections
    """

    # close db connections, they will be recreated automatically
    db.connections.close_all()

    # close ES connection, needs to be manually recreated
    connections.connections.remove_connection("default")

    # close redis connections, will be recreated automatcially
    for k in settings.CACHES.keys():
        caches[k].close()


def recreate_service_connections():
    """ All this happens automatically when django starts up, this function should only be used when writing
    multithreaded scripts where connections need to manually opened and closed so that threads don't reuse
    the same connection
    """

    # ES is the only one that needs to be recreated explicitly
    connections.connections.create_connection(hosts=[settings.ELASTIC_FULL_URL], timeout=20)


def threadwrapper(some_function, catch_exceptions=True):
    """ This wrapper should only be used when a function is being called in a multiprocessing context
    """

    def wrapper(queue, items):
        recreate_service_connections()

        for i in items:
            try:
                rv = some_function(i)
            except Exception:
                rv = None

                if catch_exceptions:
                    loggly.error("threadwrapper caught an error, continuing - %s" % traceback.format_exc())
                else:
                    raise

            queue.put(rv, block=False)

        close_service_connections()

    return wrapper


class MultiProcess(object):
    """ Nicely abstracts away some of the challenges when doing multiprocessing with Django
    Unfortunately, falls over when running tests so its not really tested
    We implement this as a context manager so we dont have to worry about garbage collection calling __del__
    """

    queue = None
    item_count = 1
    workers = []

    def __init__(self, num_workers=None, max_workers=None, debug_print=False, status_interval=20):

        if num_workers is None:

            # always use at least one threads and leave one cpu available for other stuff
            # but 1 is the minumum
            self.num_workers = cpu_count() - 1
            if self.num_workers < 2:
                self.num_workers = 1

            if max_workers and self.num_workers > max_workers:
                self.num_workers = max_workers

        else:
            self.num_workers = num_workers

        self.debug_print = debug_print

        self.status_interval = status_interval

        if debug_print:
            print("Using %s workers" % self.num_workers)

    def __enter__(self):
        close_service_connections()
        return self

    def map(self, func, iterable):

        self.queue = Manager().Queue()
        self.item_count = len(iterable) or 1

        for worker_idx in range(self.num_workers):

            items = []

            for idx, item in enumerate(iterable):
                if idx % self.num_workers == worker_idx:
                    items.append(item)

            if self.debug_print:
                print("Working on %s uids of %s in worker %s" % (len(items), len(iterable), worker_idx))

            p = Process(target=threadwrapper(func), args=[self.queue, items])
            p.start()
            self.workers.append(p)

        self._wait()

    def _wait(self):
        """ Wait for all workers to finish and wakes up peridocially to print out how much work has happened
        """
        total_time = Timer()

        while [p for p in self.workers if p.is_alive()]:

            tpt = Timer()

            for p in self.workers:
                p.join(timeout=self.status_interval)

                interval_secs = tpt.done() // 1000

                # if we've timed out on the status interval, print it out and reset the counter
                if self.debug_print and interval_secs >= self.status_interval:
                    tpt = Timer()

                    total_secs = total_time.done() // 1000

                    percent = (self.queue.qsize() * 100) // self.item_count
                    print("--------- {}% done ({}s elapsed) ---------".format(percent, total_secs))

    def results(self):
        rv = []
        try:
            while True:
                rv.append(self.queue.get(block=False))
        except Empty:
            return rv

    def __exit__(self, type, value, traceback):
        # recreate the connections so we can do more stuff
        recreate_service_connections()
