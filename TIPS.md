# Configuration tips

## Mount sparql-proxy on a relative path

Use Nginx to proxy and rewrite paths.
Consider the following snippet for `nginx.conf`:

```
http {
  server {
    listen 8888;
    location ~ ^/proxy/(.*)$ {
      proxy_pass http://localhost:3000/$1$is_args$args;
      proxy_redirect / /proxy/;
      proxy_cookie_path / /proxy/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

This enables us to mount sparql-proxy on `http://localhost:8888/proxy/`, which will be routed to `http://localhost:3000/`.
