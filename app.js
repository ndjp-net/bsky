document.getElementById('searchBtn').addEventListener('click', fetchBlueskyProfile);
document.getElementById('handle').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fetchBlueskyProfile();
});

function formatDate(isoString) {
    if (!isoString) return '???';
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// チャット設定の翻訳用
function translateChatSetting(setting) {
    switch(setting) {
        case 'all': return 'すべての人から';
        case 'following': return 'フォロー中のユーザーのみ';
        case 'none': return '誰からも受け取らない';
        default: return setting || '???';
    }
}

async function fetchBlueskyProfile() {
    let handle = document.getElementById('handle').value.trim();
    if (!handle) return;
    if (handle.startsWith('@')) handle = handle.substring(1);

    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const result = document.getElementById('result');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    result.classList.add('hidden');

    try {
        // 1. App View からプロファイル取得
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`);
        if (!response.ok) throw new Error('Account not found');
        const data = await response.json();

        // --- 基本情報の反映 ---
        document.getElementById('displayName').textContent = data.displayName || data.handle;
        document.getElementById('fullHandle').textContent = `@${data.handle}`;
        document.getElementById('followersCount').textContent = (data.followersCount || 0).toLocaleString();
        document.getElementById('followsCount').textContent = (data.followsCount || 0).toLocaleString();
        document.getElementById('postsCount').textContent = (data.postsCount || 0).toLocaleString();
        document.getElementById('description').textContent = data.description || '自己紹介はありません。';
        
        // アバターとバナー
        document.getElementById('avatar').src = data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
        if (data.banner) {
            document.getElementById('banner').style.backgroundImage = `url('${data.banner}')`;
        } else {
            document.getElementById('banner').style.backgroundImage = 'none';
            document.getElementById('banner').className = 'h-40 bg-gradient-to-r from-sky-400 to-blue-500 profile-banner';
        }
        document.getElementById('profileLink').href = `https://bsky.app/profile/${data.handle}`;

        // --- 拡張情報 (アセット・設定) ---
        const associated = data.associated || {};
        document.getElementById('starterPacks').textContent = (associated.starterPacks || 0).toLocaleString();
        document.getElementById('feedgens').textContent = (associated.feedgens || 0).toLocaleString();
        document.getElementById('lists').textContent = (associated.lists || 0).toLocaleString();
        document.getElementById('chatAllow').textContent = translateChatSetting(associated.chat?.allowIncoming);
        document.getElementById('pinnedPost').textContent = data.pinnedPost ? 'あり' : 'なし';

        // --- 拡張情報 (メタデータ) ---
        document.getElementById('createdAt').textContent = formatDate(data.createdAt);
        document.getElementById('indexedAt').textContent = formatDate(data.indexedAt);
        
        const labelsContainer = document.getElementById('labels');
        labelsContainer.innerHTML = '';
        if (data.labels && data.labels.length > 0) {
            data.labels.forEach(label => {
                const span = document.createElement('span');
                span.className = 'bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200';
                span.textContent = label.val;
                labelsContainer.appendChild(span);
            });
        } else {
            labelsContainer.textContent = 'なし';
        }

        // --- プロトコルレベル (PLC) ---
        document.getElementById('did').textContent = data.did;
        document.getElementById('pds').textContent = '取得中...';
        document.getElementById('alsoKnownAs').textContent = '取得中...';
        document.getElementById('verificationMethod').textContent = '取得中...';

        try {
            const didResponse = await fetch(`https://plc.directory/${data.did}`);
            if (didResponse.ok) {
                const didData = await didResponse.json();
                
                // PDS
                const pdsUrl = didData.service?.find(s => s.type === "AtprotoPersonalDataServer")?.serviceEndpoint;
                document.getElementById('pds').textContent = pdsUrl || '不明';
                
                // エイリアス (Also Known As)
                if (didData.alsoKnownAs && didData.alsoKnownAs.length > 0) {
                    document.getElementById('alsoKnownAs').textContent = didData.alsoKnownAs.join('\n');
                } else {
                    document.getElementById('alsoKnownAs').textContent = 'なし';
                }

                // 公開鍵
                if (didData.verificationMethod && didData.verificationMethod.length > 0) {
                    // ID部分のみ抽出して見やすくする
                    const keys = didData.verificationMethod.map(m => {
                        const keyId = m.id.split('#')[1] || 'unknown';
                        return `${keyId} (${m.type})`;
                    });
                    document.getElementById('verificationMethod').textContent = keys.join('\n');
                } else {
                    document.getElementById('verificationMethod').textContent = 'なし';
                }
            } else {
                throw new Error('PLC fetch failed');
            }
        } catch {
            document.getElementById('pds').textContent = '取得エラー';
            document.getElementById('alsoKnownAs').textContent = '取得エラー';
            document.getElementById('verificationMethod').textContent = '取得エラー';
        }

        result.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        error.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

// --- PWA Service Worker 登録 ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.warn('ServiceWorker registration failed: ', err);
            });
    });
}
