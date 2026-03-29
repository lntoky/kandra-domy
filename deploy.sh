#!/bin/bash
# deploy.sh — met à jour le cache SW et pousse sur GitHub

BUILD_TIME=$(date +%s)

# Remplace le placeholder par le timestamp actuel
sed -i "s/{{BUILD_TIME}}/temp_$BUILD_TIME/g" sw.js

git add .
git commit -m "deploy $BUILD_TIME"
git push

# Remet le placeholder pour le prochain deploy
sed -i "s/temp_$BUILD_TIME/{{BUILD_TIME}}/g" sw.js
