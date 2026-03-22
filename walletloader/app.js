const ETHPLORER_URL = "https://api.ethplorer.io/getAddressInfo";
const ETHPLORER_KEY = "freekey";
const ALCHEMY_NFT_URL = "https://eth-mainnet.g.alchemy.com/nft/v2/demo/getNFTsForOwner";
const ALCHEMY_NFT_PAGE_SIZE = 50;
const ETHERSCAN_ADDRESS_URL = "https://etherscan.io/address/";
const ETHERSCAN_TOKEN_URL = "https://etherscan.io/token/";
const TRUSTWALLET_ETH_LOGO = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";

const walletForm = document.getElementById("walletForm");
const addressInput = document.getElementById("addressInput");
const statusNode = document.getElementById("status");
const summaryNode = document.getElementById("summary");
const fungibleNode = document.getElementById("fungibleResults");
const nftNode = document.getElementById("nftResults");
const fungibleCountNode = document.getElementById("fungibleCount");
const nftCountNode = document.getElementById("nftCount");

const { ethers } = window;
const RENDER_BATCH_SIZE = 100;

let activeRequest = 0;

function setStatus(message, isError = false) {
  if (!statusNode) {
    return;
  }
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#9a2d12" : "";
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(value, options = {}) {
  if (value == null || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", options).format(Number(value));
}

function formatUsd(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 6
  }).format(Number(value));
}

function truncate(text, length = 180) {
  if (!text) {
    return "";
  }
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function clearNode(node) {
  if (!node) {
    return;
  }
  node.innerHTML = "";
  node.classList.remove("empty-state");
}

function createSummaryItem(label, value) {
  const item = document.createElement("div");
  item.className = "summary__item";
  item.innerHTML = `
    <div class="summary__label">${label}</div>
    <div class="summary__value">${value}</div>
  `;
  return item;
}

function getTokenLogoUrl(address) {
  try {
    const checksum = ethers.getAddress(address);
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${checksum}/logo.png`;
  } catch {
    return "";
  }
}

function fallbackLogo(symbol) {
  const logo = document.createElement("div");
  logo.className = "asset-logo--fallback";
  logo.textContent = (symbol || "?").slice(0, 3);
  return logo;
}

function assetMetric(label, value) {
  return `
    <div>
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </div>
  `;
}

function normalizeTokenId(rawTokenId) {
  if (rawTokenId == null || rawTokenId === "") {
    return "";
  }

  try {
    return BigInt(rawTokenId).toString();
  } catch {
    return String(rawTokenId);
  }
}

function formatTokenBalance(rawBalance, decimals) {
  if (rawBalance == null || rawBalance === "") {
    return 0;
  }

  try {
    return Number(ethers.formatUnits(String(rawBalance), decimals));
  } catch {
    return Number(rawBalance) / 10 ** decimals;
  }
}

function looksLikeLegacyCollectible(token) {
  const info = token.tokenInfo || {};
  const decimals = Number(info.decimals || 0);
  const rawBalance = Number(token.rawBalance ?? token.balance ?? 0);
  const totalSupply = Number(info.totalSupply || 0);
  const hasPrice = Number.isFinite(Number(info.price?.rate));

  return (
    Boolean(info.address) &&
    Boolean(info.name || info.symbol) &&
    decimals === 0 &&
    !hasPrice &&
    Number.isInteger(rawBalance) &&
    rawBalance > 0 &&
    rawBalance <= 10000 &&
    (totalSupply === 0 || totalSupply <= 1000000)
  );
}

function normalizeLegacyCollectible(token, ownerAddress) {
  const info = token.tokenInfo || {};
  const balance = String(token.rawBalance ?? token.balance ?? "1");

  return {
    contractAddress: info.address || "",
    collection: info.name || info.symbol || "Legacy Collectible",
    tokenId: "",
    tokenType: "Legacy Collectible",
    name: info.name || info.symbol || "Legacy Collectible",
    description: "This asset is being surfaced from the wallet's token balances because the upstream NFT indexer does not classify this older Ethereum collectible cleanly.",
    balance,
    previewUrl: "",
    previewType: "image",
    imageUrl: "",
    mediaUrl: "",
    metadataUrl: "",
    explorerUrl: `${ETHERSCAN_TOKEN_URL}${info.address}?a=${ownerAddress}`
  };
}

function renderFungibles(assets) {
  if (!fungibleCountNode || !fungibleNode) {
    return;
  }
  fungibleCountNode.textContent = String(assets.length);
  clearNode(fungibleNode);

  if (!assets.length) {
    fungibleNode.classList.add("empty-state");
    fungibleNode.innerHTML = "<p>No fungible assets were found for this wallet.</p>";
    return;
  }

  renderInBatches(
    fungibleNode,
    assets,
    (asset) => {
      const card = document.createElement("article");
      card.className = "asset-card";

      const logoUrl = asset.logoUrl;
      if (logoUrl) {
        const logo = document.createElement("img");
        logo.className = "asset-logo";
        logo.alt = `${asset.symbol || asset.name || "Token"} logo`;
        logo.src = logoUrl;
        logo.loading = "lazy";
        logo.onerror = () => {
          logo.replaceWith(fallbackLogo(asset.symbol || asset.name));
        };
        card.appendChild(logo);
      } else {
        card.appendChild(fallbackLogo(asset.symbol || asset.name));
      }

      const details = document.createElement("div");
      details.className = "asset-meta";
      details.innerHTML = `
        <div class="asset-title-row">
          <h3 class="asset-title">${asset.name || "Unnamed Token"}</h3>
          <span class="asset-symbol">${asset.symbol || "N/A"}</span>
        </div>
        <div class="asset-grid">
          ${assetMetric("Balance", asset.balanceFormatted)}
          ${assetMetric("Value", asset.usdValueFormatted)}
          ${assetMetric("Price", asset.priceFormatted)}
          ${assetMetric("Contract", shortAddress(asset.address))}
        </div>
        <div class="asset-links">
          <a href="${asset.explorerUrl}" target="_blank" rel="noopener">View On Etherscan</a>
        </div>
      `;

      card.appendChild(details);
      return card;
    },
    "assets"
  );
}

function renderNfts(nfts) {
  if (!nftCountNode || !nftNode) {
    return;
  }
  nftCountNode.textContent = String(nfts.length);
  clearNode(nftNode);

  if (!nfts.length) {
    nftNode.classList.add("empty-state");
    nftNode.innerHTML = "<p>No NFTs were found for this wallet.</p>";
    return;
  }

  renderInBatches(
    nftNode,
    nfts,
    (nft) => {
      const card = document.createElement("article");
      card.className = "nft-card";

      const media = document.createElement("div");
      media.className = "nft-media";
      if (nft.previewType === "video") {
        media.innerHTML = `<video src="${nft.previewUrl}" muted playsinline controls preload="metadata"></video>`;
      } else if (nft.previewUrl) {
        media.innerHTML = `<img src="${nft.previewUrl}" alt="${nft.name || "NFT preview"}" loading="lazy">`;
      }
      card.appendChild(media);

      const meta = document.createElement("div");
      meta.className = "nft-meta";
      meta.innerHTML = `
        <div class="nft-title-row">
          <h3 class="nft-title">${nft.name || "Untitled NFT"}</h3>
          <span class="badge">${nft.tokenType || "NFT"}</span>
        </div>
        <div class="asset-grid">
          ${assetMetric("Collection", nft.collection || "Unknown")}
          ${assetMetric("Token ID", nft.tokenId)}
          ${assetMetric("Balance", nft.balance)}
          ${assetMetric("Contract", shortAddress(nft.contractAddress))}
        </div>
        ${nft.description ? `<p class="nft-description">${truncate(nft.description, 220)}</p>` : ""}
        <div class="nft-links">
          <a href="${nft.explorerUrl}" target="_blank" rel="noopener">View Contract</a>
          ${nft.imageUrl ? `<a href="${nft.imageUrl}" target="_blank" rel="noopener">Open Image</a>` : ""}
          ${nft.mediaUrl ? `<a href="${nft.mediaUrl}" target="_blank" rel="noopener" download>Download Embedded Media</a>` : ""}
          ${nft.metadataUrl ? `<a href="${nft.metadataUrl}" target="_blank" rel="noopener">Metadata</a>` : ""}
        </div>
      `;

      card.appendChild(meta);
      return card;
    },
    "NFTs"
  );
}

function renderInBatches(container, items, renderItem, label) {
  let cursor = 0;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "load-more";

  function paintBatch() {
    const fragment = document.createDocumentFragment();
    const nextItems = items.slice(cursor, cursor + RENDER_BATCH_SIZE);

    for (const item of nextItems) {
      fragment.appendChild(renderItem(item));
    }

    container.appendChild(fragment);
    cursor += nextItems.length;

    if (cursor >= items.length) {
      button.remove();
    } else {
      button.textContent = `Show ${Math.min(RENDER_BATCH_SIZE, items.length - cursor)} More ${label}`;
      if (!button.isConnected) {
        container.appendChild(button);
      }
    }
  }

  button.addEventListener("click", paintBatch);
  paintBatch();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function fetchFungibles(address) {
  const data = await fetchJson(`${ETHPLORER_URL}/${address}?apiKey=${ETHPLORER_KEY}`);
  const assets = [];
  const legacyCollectibles = [];

  const ethBalance = Number(data?.ETH?.balance || 0);
  const ethPrice = Number(data?.ETH?.price?.rate || 0);
  if (ethBalance > 0) {
    assets.push({
      address: "ETH",
      name: "Ethereum",
      symbol: "ETH",
      logoUrl: TRUSTWALLET_ETH_LOGO,
      balanceFormatted: formatNumber(ethBalance, { maximumFractionDigits: 6 }),
      priceFormatted: formatUsd(ethPrice),
      usdValue: ethBalance * ethPrice,
      usdValueFormatted: formatUsd(ethBalance * ethPrice),
      explorerUrl: `${ETHERSCAN_ADDRESS_URL}${address}`
    });
  }

  for (const token of data.tokens || []) {
    const info = token.tokenInfo || {};
    const decimals = Number(info.decimals || 0);
    const balance = formatTokenBalance(token.rawBalance ?? token.balance, decimals);
    const price = Number(info.price?.rate || 0);

    if (!info.address || !Number.isFinite(balance) || balance <= 0) {
      continue;
    }

    if (looksLikeLegacyCollectible(token)) {
      legacyCollectibles.push(normalizeLegacyCollectible(token, address));
      continue;
    }

    assets.push({
      address: info.address,
      name: info.name || "Unnamed Token",
      symbol: info.symbol || "N/A",
      logoUrl: getTokenLogoUrl(info.address),
      balanceFormatted: formatNumber(balance, { maximumFractionDigits: decimals === 0 ? 0 : 6 }),
      priceFormatted: price ? formatUsd(price) : "Unpriced",
      usdValue: price ? balance * price : null,
      usdValueFormatted: price ? formatUsd(balance * price) : "Unpriced",
      explorerUrl: `${ETHERSCAN_TOKEN_URL}${info.address}?a=${address}`
    });
  }

  return {
    fungibles: assets.sort((a, b) => {
      const aValue = a.usdValue ?? -1;
      const bValue = b.usdValue ?? -1;
      return bValue - aValue;
    }),
    legacyCollectibles
  };
}

function normalizeNft(nft) {
  const metadata = nft.metadata || {};
  const media = Array.isArray(nft.media) ? nft.media[0] || {} : {};
  const tokenId = normalizeTokenId(nft.id?.tokenId);
  const imageUrl =
    media.gateway ||
    media.thumbnail ||
    media.raw ||
    metadata.image ||
    metadata.image_url ||
    "";
  const mediaUrl =
    metadata.animation_url ||
    metadata.animation ||
    media.raw ||
    media.gateway ||
    "";

  let previewUrl = imageUrl;
  let previewType = "image";

  if (!previewUrl && mediaUrl && (media.format || "").match(/mp4|webm|mov/i)) {
    previewUrl = mediaUrl;
    previewType = "video";
  }

  return {
    contractAddress: nft.contract?.address || "",
    collection: nft.contractMetadata?.openSea?.collectionName || nft.contractMetadata?.name || "",
    tokenId,
    tokenType: nft.id?.tokenMetadata?.tokenType || nft.contractMetadata?.tokenType || "NFT",
    name: nft.title || metadata.name || "",
    description: nft.description || metadata.description || "",
    balance: nft.balance || "1",
    previewUrl,
    previewType,
    imageUrl,
    mediaUrl,
    metadataUrl: nft.tokenUri?.gateway || nft.tokenUri?.raw || "",
    explorerUrl: `${ETHERSCAN_TOKEN_URL}${nft.contract?.address}?a=${tokenId}`
  };
}

async function fetchNfts(address) {
  const collected = [];
  let pageKey = "";
  let page = 0;

  while (page < 10) {
    const url = new URL(ALCHEMY_NFT_URL);
    url.searchParams.set("owner", address);
    url.searchParams.set("pageSize", String(ALCHEMY_NFT_PAGE_SIZE));
    if (pageKey) {
      url.searchParams.set("pageKey", pageKey);
    }

    const data = await fetchJson(url.toString());
    for (const nft of data.ownedNfts || []) {
      collected.push(normalizeNft(nft));
    }

    if (!data.pageKey) {
      break;
    }

    pageKey = data.pageKey;
    page += 1;
  }

  return collected;
}

function renderSummary(address, fungibles, nfts) {
  if (!summaryNode) {
    return;
  }
  const nftMediaCount = nfts.filter((item) => item.mediaUrl).length;
  summaryNode.hidden = false;
  summaryNode.innerHTML = "";
  summaryNode.append(
    createSummaryItem("Wallet", shortAddress(address)),
    createSummaryItem("Fungible Assets", String(fungibles.length)),
    createSummaryItem("NFTs", String(nfts.length)),
    createSummaryItem("NFTs With Embedded Media", String(nftMediaCount))
  );
}

function resetResults() {
  if (!summaryNode || !fungibleNode || !nftNode || !fungibleCountNode || !nftCountNode) {
    return;
  }
  summaryNode.hidden = true;
  summaryNode.innerHTML = "";
  fungibleNode.classList.add("empty-state");
  fungibleNode.innerHTML = "<p>No fungible assets loaded yet.</p>";
  nftNode.classList.add("empty-state");
  nftNode.innerHTML = "<p>No NFTs loaded yet.</p>";
  fungibleCountNode.textContent = "0";
  nftCountNode.textContent = "0";
}

async function loadWallet(rawAddress) {
  const requestId = ++activeRequest;
  resetResults();

  let address;
  try {
    address = ethers.getAddress(rawAddress.trim());
  } catch {
    setStatus("That is not a valid Ethereum address.", true);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("address", address);
  window.history.replaceState({}, "", url);

  setStatus("Loading fungible assets and NFTs...");

  try {
    const [fungibleResult, fetchedNfts] = await Promise.all([
      fetchFungibles(address),
      fetchNfts(address)
    ]);

    if (requestId !== activeRequest) {
      return;
    }

    const fungibles = fungibleResult.fungibles;
    const indexedContracts = new Set(
      fetchedNfts
        .map((item) => item.contractAddress?.toLowerCase())
        .filter(Boolean)
    );
    const legacyCollectibles = fungibleResult.legacyCollectibles.filter(
      (item) => !indexedContracts.has(item.contractAddress?.toLowerCase())
    );
    const nfts = [...fetchedNfts, ...legacyCollectibles];
    renderSummary(address, fungibles, nfts);
    renderFungibles(fungibles);
    renderNfts(nfts);
    setStatus(`Loaded ${fungibles.length} fungible assets and ${nfts.length} NFTs for ${shortAddress(address)}.`);
  } catch (error) {
    if (requestId !== activeRequest) {
      return;
    }

    resetResults();
    setStatus(`Unable to load wallet data right now: ${error.message}`, true);
  }
}

export async function loadWalletData(rawAddress) {
  let address;
  try {
    address = ethers.getAddress(rawAddress.trim());
  } catch {
    throw new Error("That is not a valid Ethereum address.");
  }

  const [fungibleResult, fetchedNfts] = await Promise.all([
    fetchFungibles(address),
    fetchNfts(address)
  ]);

  const fungibles = fungibleResult.fungibles;
  const indexedContracts = new Set(
    fetchedNfts
      .map((item) => item.contractAddress?.toLowerCase())
      .filter(Boolean)
  );
  const legacyCollectibles = fungibleResult.legacyCollectibles.filter(
    (item) => !indexedContracts.has(item.contractAddress?.toLowerCase())
  );
  const nfts = [...fetchedNfts, ...legacyCollectibles];

  return { address, fungibles, nfts };
}

export { fetchFungibles, fetchNfts, normalizeNft };

if (walletForm && addressInput) {
  walletForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadWallet(addressInput.value);
  });

  const presetAddress = new URL(window.location.href).searchParams.get("address");
  if (presetAddress) {
    addressInput.value = presetAddress;
    loadWallet(presetAddress);
  }
}
