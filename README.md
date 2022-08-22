# Snarfetch

May eventually be a helpful fetch wrapper/implementation that does things like caching and throttling.

## Use

At its most basic:

```javascript
import { fetch } from 'node-fetch';
await fetch('https://localhost');
```

The API exposed is the API provided by `node-fetch` and unless it's necessary to change it, what you pass in will be passed through.

The global `fetch` uses a default context and cache.
If you want to change any of the options, or you want a separate cache, instantiate your own:

```javascript
import { Snarfetch } from 'node-fetch';

const context = new Snarfetch({});
await context.fetch('https://localhost');
```

## Roadmap

* [x] Wraps node-fetch.
* [x] Throttles requests to servers that are struggling.
* [x] Will avoid making requests in parallel when they may be deduplicated.
* [x] Won't re-use a response that's expired.
* [ ] Will expire items from the cache.
* [ ] Will limit the size of object that will be cached.
* [ ] Will pay attention to `vary`.
* [ ] Will revalidate requests rather than retrying them.
* [ ] Will pay attention to `last-modified`.
* [ ] Will pay attention to `etag`.
* [ ] Will store/suggest multiple versions returned with `etag`.
* [ ] Will serve stale when allowed and unable to access the resource.
* [ ] Will "pre-fresh" entries which are heavily used and due to expire soon, to prevent them from expiring.

## Internals

A 'target' is a host/port combo.
We throttle each target separately, and cache based on the path and query string within each target.
This gives us a 'location'.

If we've not seen a location before, we'll only make one request until we get an indication of whether we can cache it or not.
If we can't, we'll fire off any requests that might have been pending and won't wait next time.
If we can, we'll read the entire body and return responses that stream from the cached Blob.

Once a cached location has expired, a subsequent request will zap the cache and start the process again.
This is a fresh fetch, rather than a revalidation -- we discard the previous body.
