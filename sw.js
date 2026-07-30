const CACHE_NAME = 'bsky-checker-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './image/icon.png'
];

// 1. インストール時の処理
self.addEventListener('install', event => {
    // 新しいService Workerを即座に待機状態からアクティブにする
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. アクティブ時の処理（古いキャッシュのクリーンアップ）
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // 現在のバージョン以外の古いキャッシュを削除
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 即座にクライアントのコントロールを開始する
            return self.clients.claim();
        })
    );
});

// 3. フェッチ時の処理（Stale-while-revalidate 戦略など）
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // APIリクエストはキャッシュせず常にネットワークへ (Network Only)
    if (url.hostname.includes('api.bsky.app') || url.hostname.includes('plc.directory')) {
        return; 
    }
    
    // 静的アセットのキャッシュ戦略: Stale-while-revalidate
    // まずキャッシュを返しつつ、裏でネットワークから最新版を取得してキャッシュを更新する
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // 正常なレスポンスのみキャッシュを更新
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // オフラインでネットワーク取得に失敗した場合のフォールバック
                console.warn('[Service Worker] Fetch failed, offline mode.');
            });

            // キャッシュがあれば即座に返し、なければネットワークリクエスト(fetchPromise)の結果を待つ
            return cachedResponse || fetchPromise;
        })
    );
});
