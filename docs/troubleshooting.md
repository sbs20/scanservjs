# Troubleshooting

## JSON.parse error

This happens when the browser received a string from the server which is not a
valid JSON string. Most likely you're running a proxy server (e.g. nginx) which
is timing out prior to the completion of the request. Scanservjs can sometimes
take a little while to fulfil its requests - usually because it's waiting for a
scanner, but sometimes because it's having to do a fair amount of image
processing and you're
[running on a low power CPU (e.g. RPi)](https://github.com/sbs20/scanservjs/issues/224).

The solution is to increase the proxy timeout. For nginx that might look like:

```
server{
   ...
   proxy_read_timeout 300;
   proxy_connect_timeout 300;
   proxy_send_timeout 300; 
   ...
}
```

## Long scan timeout

When scanning files with high resolution, e.g. 1200dpi it is very likely for the
request to timeout. This is because node HTTP times out after 2 minutes by
default. The solution is to increase the default timeout. That's possible by
setting `config.timeout = 600000;` (for 10 minutes for example).