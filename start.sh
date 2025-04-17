docker run --name web -d -p 8080:80 \
-v $PWD/index.html:/usr/share/nginx/html/index.html \
-v $PWD/index.css:/usr/share/nginx/html/index.css \
-v $PWD/index.js:/usr/share/nginx/html/index.js \
nginx:1.24 
