// New story uses its own fallback cards; visited chapters use engine snapshots.
for(const id of ['office','tower','boat','swarm','dominoes','lamp','selectall','pile','questions'])window.__ASSETS['thumb-'+id+'.jpg']='../assets/thumb-'+id+'.svg';
const cover=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#080c14"/><circle cx="480" cy="270" r="170" fill="none" stroke="#ec683d" stroke-width="4"/><text x="480" y="280" text-anchor="middle" font-family="Arial" font-size="52" fill="#fff">The work breaks out.</text></svg>`;
window.__ASSETS['thumb-detonation.jpg']='data:image/svg+xml,'+encodeURIComponent(cover);
