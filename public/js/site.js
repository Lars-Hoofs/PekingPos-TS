document.querySelectorAll("[data-order-screen]").forEach(screen => {
  const tabs = screen.querySelectorAll("[data-view-tab]");
  const buttons = screen.querySelectorAll("[data-category]");
  const panes = screen.querySelectorAll("[data-category-pane]");
  const title = screen.querySelector("[data-category-title]");
  const hint = screen.querySelector("[data-view-hint]");
  const search = screen.querySelector("[data-product-search]");
  const hints = { food: "tik om toe te voegen", drinks: "tik op + of − om aan te passen" };

  function showCategory(id) {
    buttons.forEach(b => {
      const active = b.dataset.category === id;
      b.classList.toggle("actief", active);
      if (active) title.textContent = b.dataset.title;
    });
    panes.forEach(p => p.hidden = p.dataset.categoryPane !== id);
    search.value = "";
    screen.querySelectorAll("[data-row]").forEach(row => row.hidden = false);
    screen.dataset.activeCategory = id;
  }

  function showView(view, categoryId) {
    screen.dataset.view = view;
    tabs.forEach(t => t.classList.toggle("aan", t.dataset.viewTab === view));
    buttons.forEach(b => b.hidden = b.dataset.categoryView !== view);
    hint.textContent = hints[view];
    const first = [...buttons].find(b => b.dataset.categoryView === view);
    const wanted = [...buttons].find(b => b.dataset.category === categoryId && b.dataset.categoryView === view);
    if (wanted || first) showCategory((wanted || first).dataset.category);
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    url.searchParams.delete("category");
    history.replaceState(null, "", url);
  }

  tabs.forEach(t => t.addEventListener("click", event => {
    event.preventDefault();
    showView(t.dataset.viewTab);
  }));
  buttons.forEach(b => b.addEventListener("click", () => showCategory(b.dataset.category)));

  search.addEventListener("input", () => {
    const text = search.value.trim().toLowerCase();
    if (text === "") {
      showCategory(screen.dataset.activeCategory);
      return;
    }
    title.textContent = "Zoekresultaat";
    panes.forEach(p => p.hidden = p.dataset.categoryView !== screen.dataset.view);
    screen.querySelectorAll("[data-row]").forEach(row => row.hidden = !row.textContent.toLowerCase().includes(text));
  });

  showCategory(screen.dataset.activeCategory);
});

// + and − on a drink tile change the order without reloading the page. The server answers with
// the order page; the tiles and the order panel are swapped for the new ones. Taps are handled
// one after another, so fast tapping counts every tap. Without JavaScript the forms post normally.
let liveQueue = Promise.resolve();

document.addEventListener("submit", event => {
  const form = event.target.closest("[data-live-form]");
  if (!form) return;
  event.preventDefault();
  liveQueue = liveQueue.then(() => submitLive(form));
});

async function submitLive(form) {
  const tile = form.closest("[data-live]");
  tile?.classList.add("bezig");
  let response;
  try {
    response = await fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)) });
  } catch {
    form.submit();
    return;
  }
  const url = new URL(response.url);
  if (!response.ok || url.pathname !== location.pathname) {
    location.assign(response.url);
    return;
  }
  const page = new DOMParser().parseFromString(await response.text(), "text/html");
  page.querySelectorAll("[data-live][id]").forEach(fresh => {
    const current = document.getElementById(fresh.id);
    if (current) current.replaceWith(document.importNode(fresh, true));
  });
  document.querySelectorAll(".toast").forEach(toast => toast.remove());
  const toast = page.querySelector(".toast");
  if (toast) document.body.append(document.importNode(toast, true));
}

document.querySelectorAll("[data-line-form]").forEach(form => {
  const quantity = form.querySelector("[name=quantity]");
  const total = form.querySelector("[data-line-total]");

  function updateTotal() {
    const sideDish = form.querySelector("[name=sideDishId]:checked");
    const surcharge = sideDish ? Number(sideDish.dataset.surcharge) : 0;
    const amount = Number(quantity.value) * (Number(form.dataset.price) + surcharge);
    total.textContent = Number.isFinite(amount)
      ? "€ " + amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";
  }

  form.querySelectorAll("[data-delta]").forEach(button => button.addEventListener("click", () => {
    quantity.value = Math.min(99, Math.max(1, (Number(quantity.value) || 0) + Number(button.dataset.delta)));
    updateTotal();
  }));
  form.addEventListener("input", updateTotal);
  updateTotal();
});

document.querySelectorAll("[data-print]").forEach(button => button.addEventListener("click", () => window.print()));
