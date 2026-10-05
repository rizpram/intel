server {
    listen 80;
    listen [::]:80;
    server_name intel.rizpram.cloud;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { proxy_pass http://127.0.0.1:3210; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto http; proxy_set_header X-Real-IP $remote_addr; }
}
