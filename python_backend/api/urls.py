from django.urls import path
from . import views

urlpatterns = [
    path('getWebsocketKlines/', views.getWebsocketKlines, name='getWebsocketKlines'),
    path('getHttpKlines/', views.getHttpKlines, name='getHttpKlines'),
    path('getPercentGainers/', views.getPercentGainers, name='getPercentGainers'),
    path('get15MinuteHighs/', views.get15MinuteHighs, name='get15MinuteHighs'),
    path('getFuturesOpenOrders/', views.getFuturesOpenOrders, name='getFuturesOpenOrders'),
    path('getFuturesUserData/', views.getFuturesUserData, name='getFuturesUserData'),
    path('market/', views.marketOrder, name='marketOrder'),
    path('stop/', views.stopOrder, name='stopOrder'),
    path('limit/', views.limitOrder, name='limitOrder'),
]