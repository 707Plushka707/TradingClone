import math

from django.shortcuts import render
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from django.http import JsonResponse
from binance.client import Client, AsyncClient
from binance.exceptions import BinanceAPIException, BinanceOrderException
from binance import ThreadedWebsocketManager
from unicorn_binance_websocket_api.unicorn_binance_websocket_api_manager import BinanceWebSocketApiManager
import unicorn_binance_rest_api
from unicorn_fy.unicorn_fy import UnicornFy
from operator import itemgetter
import requests
import json
import os
from multiprocessing import Pool, Process
from .models import MultiProcess
import asyncio, time
import numpy as np
import pandas as pd
from numba import jit, cuda
from datetime import datetime
import time
# LOCAL_TIMEZONE = datetime.now(datetime.timezone.utc).astimezone().tzinfo
from calendar import monthrange
from queue import Queue
import requests
import aiohttp
import websockets

# Create your views here.

binance_api_key = "LxxlvPJTckWPKGTEsoIWa5eCpytCTDqAizP7JAzuzGKLKZiPhx368sWTHABV1vMN"
binance_api_secret = "a30pZsNVNctmHKKuFCabCfbrLWyCVgCSWaH2UFfpatS4fSaQJF9kOXfJrWIOsoIe"

client = Client(binance_api_key, binance_api_secret)

websocket_running = False
all_streams_running = False
http_fetched = False
global subsequent_finished_klines_queue
global all_streams
global all_futures_historical_klines
global markets
global percent_change_dict


@api_view(["GET"])
@csrf_exempt
def getWebsocketKlines(request):
    global websocket_running
    global all_streams_running

    if not websocket_running:
        websocket_running = True
        global channels
        global ubwa
        global stream_id_dict
        global all_streams
        global subsequent_finished_klines_queue
        global markets

        prices = client.futures_mark_price()

        markets = []
        for val in prices:
            markets.append(val["symbol"])

        all_streams = {}
        for symbol in markets:
            all_streams[symbol] = {}

        ubwa = BinanceWebSocketApiManager(exchange="binance.com-futures")
        channels = ['kline_1m', 'kline_5m', 'kline_15m', 'kline_1h', 'kline_4h', 'kline_1d', 'kline_1w', 'kline_1M']
        stream_id_dict = {}
        subsequent_finished_klines_queue = Queue(maxsize=0) # infinite-size queue

        def list_fragmenter(symbol_list):
            list_of_lists = []
            for symbol in symbol_list:
                for k in range(len(channels)):
                    list_of_lists.append([symbol, channels[k]])
            return list_of_lists

        async def start_threads(symbol_and_channel_list):
            stream_id = ubwa.create_stream(markets=symbol_and_channel_list[0], channels=symbol_and_channel_list[1],
                                           stream_buffer_name=True)
            stream_id_dict[stream_id] = symbol_and_channel_list[0]

        async def run_start_threads_in_parallel(markets_list_fragments):
            for market_fragment in markets_list_fragments:
                task = asyncio.create_task(start_threads(market_fragment))
                await task

        markets_list_fragments = list_fragmenter(markets)

        start = time.time()
        asyncio.run(run_start_threads_in_parallel(markets_list_fragments))
        end = time.time()
        print("Took {} seconds to start {} websockets.".format(end - start, 1184))
        all_streams_running = True

        # begin parallelization of updating all_streams dictionary with most recent kline
        def dictionary_fragmenter(dictionary):
            j = 0
            list_of_dicts = [{} for _ in range(len(markets) * len(channels))]
            for stream_id in dictionary:
                list_of_dicts[j][stream_id] = dictionary[stream_id]
                j += 1
            return list_of_dicts

        async def handle_current_dictionary_fragment(dict_fragment):
            for stream_id in dict_fragment:  # run this in #ofcores different processes

                oldest_data_from_stream_buffer = ubwa.pop_stream_data_from_stream_buffer(stream_buffer_name=stream_id)

                if oldest_data_from_stream_buffer:
                    data = json.loads(str(oldest_data_from_stream_buffer))
                    if "result" in data:
                        continue
                    all_streams[dict_fragment[stream_id]][data["stream"]] = data["data"]["k"]
                    if data["data"]["k"]["x"]:
                        subsequent_finished_klines_queue.put(data["data"]["k"])

        async def handle_batch_of_dicts_in_parallel(inputted_dict_fragments):
            for dict_fragment in inputted_dict_fragments:
                task = asyncio.create_task(handle_current_dictionary_fragment(dict_fragment))
                await task

        dict_fragments = dictionary_fragmenter(stream_id_dict)

        while True:
            asyncio.run(handle_batch_of_dicts_in_parallel(dict_fragments))
            time.sleep(0.01)

@api_view(["GET"])
@csrf_exempt
def getHttpKlines(request):
    global http_fetched
    global all_streams_running

    if not http_fetched:
        while True:
            if all_streams_running:
                global all_futures_historical_klines
                global subsequent_finished_klines_queue
                global markets

                prices = client.futures_mark_price()

                markets = []
                for val in prices:
                    markets.append(val["symbol"])

                all_futures_historical_klines = {}
                for symbol in markets:
                    all_futures_historical_klines[symbol] = {}

                eight_timeframes = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]

                urls = {}

                for symbol in markets:
                    for timeframe in eight_timeframes:
                        urls[symbol + "@" + timeframe] = 'https://api.binance.com/api/v3/klines?symbol=' + symbol.upper() \
                                                               + '&interval=' + timeframe + '&limit=2'

                current_unix_timestamp_seconds = datetime.timestamp(datetime.now())

                async def get(url, key, session):
                    try:
                        async with session.get(url=url) as response:
                            historical_klines = await response.json()
                            #print(historical_klines)
                            symbol_and_timeframe = key.split("@")
                            symbol = symbol_and_timeframe[0]
                            timeframe = symbol_and_timeframe[1]
                            if len(historical_klines) > 1: #i.e., you have a finished candle that isn't websocket
                                if "code" in historical_klines:
                                    print(symbol)
                                all_futures_historical_klines[symbol][timeframe] = historical_klines[0:-1] #cutting off websocket candle
                            else:
                                all_futures_historical_klines[symbol][timeframe] = []
                            #print("Successfully got url {} with resp of length {}.".format(url, len(historical_klines)))
                    except Exception as e:
                        print("Unable to get url {} due to {}.".format(url, e))

                async def main(urls):
                    async with aiohttp.ClientSession() as session:
                        ret = await asyncio.gather(*[get(urls[key], key, session) for key in urls])
                    #print("Finalized all. Return is a list of len {} outputs.".format(len(ret)))

                start = time.time()
                asyncio.run(main(urls))
                end = time.time()

                print("Took {} seconds to pull {} websites.".format(end - start, len(urls)))

                # update klines here

                http_fetched = True

                while True: # need this to keep it running when the queue is empty it should continue checking, not return, ever
                    try:
                        kline = subsequent_finished_klines_queue.get()
                        if kline["T"] > current_unix_timestamp_seconds:
                            kline_values = [kline["t"], kline["o"], kline["h"], kline["l"], kline["c"], kline["v"], kline["T"],
                                            kline["q"], kline["n"], kline["V"], kline["Q"], kline["B"]]
                            all_futures_historical_klines[kline["s"]][kline["i"]].append(kline_values)
                        time.sleep(0.01)

                    except:
                        time.sleep(0.01)
                        continue
                return JsonResponse(all_futures_historical_klines)
            else:
                time.sleep(0.01)
                continue


@api_view(["GET"])
@csrf_exempt
def getPercentGainers(request):
    global all_streams
    global percent_change_dict
    global markets

    if all_streams_running:

        percent_change_dict = {}
        for symbol in markets:
            percent_change_dict[symbol] = {}

        def dictionary_fragmenter_percent_gainers(dictionary):
            list_of_dicts = [{} for _ in range(len(markets) * 8)]
            i = 0
            for symbol in dictionary:
                eight_klines = dictionary[symbol]
                for timeframe in eight_klines:
                    list_of_dicts[i][timeframe] = eight_klines[timeframe]
                    i += 1
            return list_of_dicts

        async def handle_current_dictionary_fragment(dict_fragment):
            for timeframe in dict_fragment:
                symbol = timeframe.split("@")[0]
                kline_values = dict_fragment[timeframe]
                try:
                    percent_gain_for_timeframe = (float(kline_values["c"]) - float(
                        kline_values["o"])) / float(kline_values["o"]) * 100
                    percent_change_dict[symbol.upper()][timeframe] = percent_gain_for_timeframe
                except:
                    continue

        async def handle_batch_of_dicts_in_parallel(inputted_dict_fragments):
            for dict_fragment in inputted_dict_fragments:
                task = asyncio.create_task(handle_current_dictionary_fragment(dict_fragment))
                await task

        dict_fragments = dictionary_fragmenter_percent_gainers(all_streams)

        start = time.perf_counter()
        proc = Process(target=handle_batch_of_dicts_in_parallel, args=(dict_fragments,))
        proc.start()
        proc.join() # doesn't move on until function is finished
        # asyncio.run(handle_batch_of_dicts_in_parallel(dict_fragments))
        end = time.perf_counter()

        # start = time.perf_counter()
        # asyncio.run(handle_batch_of_dicts_in_parallel(dict_fragments))
        # end = time.perf_counter()

        print(f'Finished in {round(end - start, 2)} second(s)')

        return JsonResponse(percent_change_dict)
    else:
        return JsonResponse({"code": "Key"})


checking_for_15_minute_highs_started = False

fifteen_min_highs = []

def checkFor15MinHighs():
    global fifteen_min_highs
    global all_streams
    global all_futures_historical_klines
    global markets

    scan_candidates = []
    for symbol in markets:
        scan_candidates.append(symbol + "@15m")

    async def handle_current_symbol(symbol_and_timeframe):
        list_symbol_and_timeframe = symbol_and_timeframe.split("@")
        symbol = list_symbol_and_timeframe[0]
        timeframe = list_symbol_and_timeframe[1]
        try:
            while True:
                historical_kline_values = all_futures_historical_klines[symbol][timeframe]
                current_websocket_kline = all_streams[symbol][symbol.lower() + "@kline_" + timeframe]
                if current_websocket_kline["h"] <= historical_kline_values[-1][2]:
                    while True:
                        historical_kline_values = all_futures_historical_klines[symbol][timeframe]
                        current_websocket_kline = all_streams[symbol][symbol.lower() + "@kline_" + timeframe]
                        if current_websocket_kline["c"] > historical_kline_values[-1][2]:
                            fifteen_min_highs.append(symbol)
                            while True:
                                current_1m_websocket_kline = all_streams[symbol][symbol.lower() + "@kline_1m"]
                                if current_1m_websocket_kline["x"]:
                                    fifteen_min_highs.remove(symbol)
                                    break
                        break
        except:
            pass

    async def handle_candidates_in_parallel(candidates):
        for symbol_and_timeframe in candidates:
            task = asyncio.create_task(handle_current_symbol(symbol_and_timeframe))
            await task

    asyncio.run(handle_candidates_in_parallel(scan_candidates))


@api_view(["GET"])
@csrf_exempt
def get15MinuteHighs(request):
    global checking_for_15_minute_highs_started
    global fifteen_min_highs
    global percent_change_dict

    scan_results = {}

    if http_fetched:
        if not checking_for_15_minute_highs_started:
            checking_for_15_minute_highs_started = True
            checkFor15MinHighs()
        for symbol in fifteen_min_highs:
            scan_results[symbol] = percent_change_dict[symbol]
    return JsonResponse(scan_results)


@api_view(["GET"])
@csrf_exempt
def getFuturesOpenOrders(request):
    try:
        response = client.futures_get_open_orders()
        return JsonResponse(response, safe=False)
    except BinanceAPIException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})


@api_view(['GET'])
@csrf_exempt
def getFuturesUserData(request):
    bwam = BinanceWebSocketApiManager(exchange="binance.com-futures")
    # set api key and secret for userData stream
    binance_api_key = "LxxlvPJTckWPKGTEsoIWa5eCpytCTDqAizP7JAzuzGKLKZiPhx368sWTHABV1vMN"
    binance_api_secret = "a30pZsNVNctmHKKuFCabCfbrLWyCVgCSWaH2UFfpatS4fSaQJF9kOXfJrWIOsoIe"
    userdata_stream_id = bwam.create_stream(["arr"], ["!userData"], api_key=binance_api_key, api_secret=binance_api_secret)
    return JsonResponse({'streamId' : userdata_stream_id})


@api_view(["POST"])
@csrf_exempt
def marketOrder(request):
    data = json.loads(request.body.decode('utf-8'))
    try:
        order = client.futures_create_order(
            symbol=data["symbol"],
            side=data["side"],
            type=data["type"],
            quantity=data["quantity"])
        return JsonResponse(order, safe=False)
    except BinanceAPIException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})
    except BinanceOrderException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})


@api_view(["POST"])
@csrf_exempt
def stopOrder(request):
    # Stop Order:
    data = json.loads(request.body.decode('utf-8'))
    try:
        order = client.futures_create_order(
            symbol=data["symbol"],
            type=data["type"],
            side=data["side"],
            stopPrice=data["stopPrice"],
            quantity=data["quantity"])
        return JsonResponse(order, safe=False)
    except BinanceAPIException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})
    except BinanceOrderException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})


@api_view(["POST"])
@csrf_exempt
def limitOrder(request):
    data = json.loads(request.body.decode('utf-8'))
    try:
        order = client.futures_create_order(
            symbol=data["symbol"],
            type=data["type"],
            side=data["side"],
            price=data["price"],
            timeInForce = "GTC",
            quantity=data["quantity"])
        return JsonResponse(order, safe=False)
    except BinanceAPIException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})
    except BinanceOrderException as e:
        # error handling goes here
        return JsonResponse({'error': e.message})