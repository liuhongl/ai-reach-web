#!/bin/sh
set -eu

nginx=/usr/local/nginx/sbin/nginx
config=/home/lingchen/mid/nginx-1.28.0/conf/nginx-web.conf

"$nginx" -t -c "$config"
"$nginx" -s reload -c "$config"
