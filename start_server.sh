#!/bin/bash
# 連棋 (Lianqi Challenge) iPad 本地伺服器啟動腳本
DIR="/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24"
PORT=8080

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo "=========================================================="
echo "🎲 連棋大挑戰 V6 (iPad 優化一次到位版) 本地伺服器"
echo "=========================================================="
echo "📂 目錄: $DIR"
echo "🌐 本機 IP: $IP"
echo "📱 iPad 請在 Safari 輸入: http://$IP:$PORT"
echo "👉 建議點選 Safari「分享」->「加入主畫面」享受全螢幕 App 體驗！"
echo "=========================================================="

cd "$DIR"
python3 -m http.server $PORT
