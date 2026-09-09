/* =============================================================================
   Two behaviours: the clock counts down, and the registration submits.

   Both pages load this file; each behaviour looks for its own element and
   returns quietly when the page does not have one.
   ========================================================================== */

/** Where registrations go.
 *
 *  null composes the registration as an email in the visitor's own mail
 *  client — works the minute the folder is uploaded, with no server at all.
 *  Point it at an endpoint and the same form posts JSON there instead, with
 *  no other change to the page. */
const REGISTER_ENDPOINT = "/api/thon";

/** Fallback address, used when REGISTER_ENDPOINT is null. */
const REGISTER_EMAIL = "info@buildinclt.com";

/* ── the clock ──────────────────────────────────────────────────────────── */

(function countdown() {
  const clock = document.querySelector(".clock");
  if (!clock) return;

  // The deadline lives in the markup, not here, so moving the event is one
  // edit to a page rather than a change to a script.
  const target = new Date(clock.dataset.deadline);
  if (Number.isNaN(target.getTime())) return; // leaves the written date in place

  // Подписи берутся из разметки: у страницы свой язык, а у скрипта его быть
  // не должно — иначе перевод сайта требует правки кода.
  const written = (clock.dataset.labels || "Days,Hours,Minutes,Seconds").split(",");
  const units = ["days", "hours", "minutes", "seconds"].map((key, i) => ({
    key,
    label: (written[i] || "").trim(),
  }));

  // Built once; only the digits are touched afterwards. Rebuilding four
  // elements every second is how a countdown ends up flickering.
  clock.textContent = "";
  const digits = {};
  units.forEach((unit, i) => {
    if (i) {
      const sep = document.createElement("span");
      sep.className = "clock__sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = ":";
      clock.append(sep);
    }
    const cell = document.createElement("span");
    cell.className = "clock__unit";
    const value = document.createElement("b");
    const label = document.createElement("small");
    label.textContent = unit.label;
    cell.append(value, label);
    clock.append(cell);
    digits[unit.key] = value;
  });

  const pad = (n) => String(n).padStart(2, "0");

  function tick() {
    const left = target.getTime() - Date.now();

    if (left <= 0) {
      clock.classList.add("clock--done");
      digits.days.textContent = "00";
      digits.hours.textContent = "00";
      digits.minutes.textContent = "00";
      digits.seconds.textContent = "00";
      clearInterval(timer);
      return;
    }

    const s = Math.floor(left / 1000);
    digits.days.textContent = pad(Math.floor(s / 86400));
    digits.hours.textContent = pad(Math.floor(s / 3600) % 24);
    digits.minutes.textContent = pad(Math.floor(s / 60) % 60);
    digits.seconds.textContent = pad(s % 60);
  }

  tick();
  const timer = setInterval(tick, 1000);
})();

/* ── the registration ───────────────────────────────────────────────────── */

(function registration() {
  const form = document.getElementById("reg");
  if (!form) return;

  const status = document.getElementById("status");
  const done = document.getElementById("done");
  const submit = form.querySelector("button[type=submit]");

  const say = (message, isError) => {
    status.textContent = message;
    if (isError) status.dataset.error = "";
    else delete status.dataset.error;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // «Хотя бы один мессенджер» разметкой не выражается: required на обоих
    // потребовал бы оба, а у большинства есть только один.
    const tg = form.elements.telegram;
    const wa = form.elements.whatsapp;
    tg.setCustomValidity(
      !tg.value.trim() && !wa.value.trim()
        ? "Оставьте Telegram или WhatsApp — туда мы и ответим"
        : ""
    );
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const registration = {
      name: data.get("name")?.trim(),
      city: data.get("city")?.trim(),
      telegram: data.get("telegram")?.trim(),
      whatsapp: data.get("whatsapp")?.trim(),
      link: data.get("link")?.trim(),
      // Checkbox groups arrive as several entries under one name; radios as one.
      typology: data.getAll("typology").join(", "),
      role: data.getAll("role").join(", "),
      experience: data.get("experience"),
      attendance: data.get("attendance"),
      team: data.get("team"),
      goal: data.get("goal")?.trim(),
      thon: "Modulthon 01",
      page: location.href,
    };

    if (!REGISTER_ENDPOINT) {
      const body = Object.entries(registration)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const subject = `Modulthon 01 — ${registration.name || "registration"}`;
      location.href =
        `mailto:${REGISTER_EMAIL}?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
      say("Your mail client is opening with the registration filled in — send it to finish.");
      return;
    }

    submit.disabled = true;
    say("Sending…");

    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });
      if (!response.ok) throw new Error(String(response.status));

      form.hidden = true;
      done.hidden = false;
      openJoin();
      done.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      submit.disabled = false;
      say(`That did not go through. Send it to ${REGISTER_EMAIL} and we will pick it up there.`, true);
    }
  });
})();

/* ── окно «вступите в канал» ────────────────────────────────────────────── */

/* Показывается один раз, сразу после успешной отправки. Канал — единственное
   место, где участник потом узнает бриф и результат, поэтому предложение
   стоит там, где интерес максимален, а не строчкой в письме, которого он
   может и не открыть. */
function openJoin() {
  const box = document.getElementById("join");
  if (!box) return;
  // showModal даёт ловушку фокуса, Esc и подложку; show() — ничего из этого.
  if (typeof box.showModal === "function" && !box.open) box.showModal();
  else box.setAttribute("open", "");            // на случай старого браузера
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-join]")) openJoin();
});
