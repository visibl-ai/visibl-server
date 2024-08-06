#!/bin/bash
SKU=$1
ffprobe "../bindings/m4b/$SKU.m4b" -hide_banner > "../bindings/m4b/$SKU.ffprobe" 2>&1
ffmpeg -y -i "../bindings/m4b/$SKU.m4b" -an -vcodec copy "../bindings/m4b/$SKU.jpg" -hide_banner > /dev/null 2>&1
SKU=$SKU mocha generateMetadata.js