const params = new URLSearchParams(window.location.search);
const key = params.get("key");
const adminLink = document.querySelector("#admin-link");
const adminLinkPath = document.querySelector("#admin-link-path");

if (key) {
  const href = `/admin?key=${encodeURIComponent(key)}`;
  adminLink.href = href;
  adminLinkPath.textContent = href;
}
