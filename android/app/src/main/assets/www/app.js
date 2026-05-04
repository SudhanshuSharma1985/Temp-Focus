const START_HOUR = 6;
const END_HOUR = 23;
const SLOT_HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
const STORAGE_KEY = "tempo-focus-state-v1";
const SLOT_COUNT = SLOT_HOURS.length;

const DEFAULT_DAY_PRIORITIES = [
  "Protect the main deep work block",
  "Move body or train",
  "Learn one useful thing",
  "Wind down before sleep"
];

const DEFAULT_WEEK_PRIORITIES = [
  "Ship the highest-leverage project",
  "Keep health rhythm steady",
  "Strengthen one relationship",
  "Review money and planning"
];

const CATEGORIES = {
  admin: { label: "Unassigned", score: 55, color: "#7b8794", focus: false, waste: false, hidden: true },
  bad: { label: "Bad", score: 25, color: "#d94b3d", focus: false, waste: true },
  avg: { label: "Average", score: 55, color: "#f2b84b", focus: false, waste: false },
  good: { label: "Good", score: 88, color: "#0f8b8d", focus: true, waste: false }
};

const state = loadState();
const els = {};
let selectedDate = dateKey(new Date());
let activeTab = "daily";
let dismissedFocusKey = "";

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  selectedDate = state.selectedDate || dateKey(new Date());
  els.dateInput.value = selectedDate;
  ensurePriorities(selectedDate);
  bindEvents();
  registerServiceWorker();
  renderAuth();
  renderAll();
  checkReminderAndAlerts();
  window.setInterval(checkReminderAndAlerts, 60000);
}

function cacheElements() {
  els.authScreen = document.querySelector("#authScreen");
  els.appShell = document.querySelector("#appShell");
  els.emailLoginForm = document.querySelector("#emailLoginForm");
  els.emailInput = document.querySelector("#emailInput");
  els.authStatus = document.querySelector("#authStatus");
  els.userEmailChip = document.querySelector("#userEmailChip");
  els.logoutButton = document.querySelector("#logoutButton");
  els.todayLabel = document.querySelector("#todayLabel");
  els.enableRemindersButton = document.querySelector("#enableRemindersButton");
  els.reminderButtonText = document.querySelector("#reminderButtonText");
  els.exportButton = document.querySelector("#exportButton");
  els.importButton = document.querySelector("#importButton");
  els.importInput = document.querySelector("#importInput");
  els.dayPriorities = document.querySelector("#dayPriorities");
  els.weekPriorities = document.querySelector("#weekPriorities");
  els.addDayPriority = document.querySelector("#addDayPriority");
  els.addWeekPriority = document.querySelector("#addWeekPriority");
  els.resetDayPriorities = document.querySelector("#resetDayPriorities");
  els.resetWeekPriorities = document.querySelector("#resetWeekPriorities");
  els.moodFace = document.querySelector("#moodFace");
  els.moodTitle = document.querySelector("#moodTitle");
  els.moodDetail = document.querySelector("#moodDetail");
  els.focusAlert = document.querySelector("#focusAlert");
  els.focusAlertCopy = document.querySelector("#focusAlertCopy");
  els.dismissFocusAlert = document.querySelector("#dismissFocusAlert");
  els.loggedMetric = document.querySelector("#loggedMetric");
  els.focusMetric = document.querySelector("#focusMetric");
  els.wasteMetric = document.querySelector("#wasteMetric");
  els.streakMetric = document.querySelector("#streakMetric");
  els.dateInput = document.querySelector("#dateInput");
  els.jumpCurrentButton = document.querySelector("#jumpCurrentButton");
  els.testReminderButton = document.querySelector("#testReminderButton");
  els.focusAlertsToggle = document.querySelector("#focusAlertsToggle");
  els.thresholdSelect = document.querySelector("#thresholdSelect");
  els.hourList = document.querySelector("#hourList");
  els.analysisSummary = document.querySelector("#analysisSummary");
  els.chartShell = document.querySelector("#chartShell");
  els.insightList = document.querySelector("#insightList");
  els.coachButton = document.querySelector("#coachButton");
  els.coachOutput = document.querySelector("#coachOutput");
  els.priorityTemplate = document.querySelector("#priorityTemplate");
  els.hourTemplate = document.querySelector("#hourTemplate");
}

function bindEvents() {
  els.emailLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginWithEmail();
  });

  els.logoutButton.addEventListener("click", logout);
  els.coachButton.addEventListener("click", generateCoachAdvice);

  els.dateInput.addEventListener("change", () => {
    selectedDate = els.dateInput.value || dateKey(new Date());
    state.selectedDate = selectedDate;
    ensurePriorities(selectedDate);
    saveState();
    renderAll();
  });

  els.enableRemindersButton.addEventListener("click", enableReminders);
  els.testReminderButton.addEventListener("click", () => {
    notify("TempoFocus ping", "Log the last hour and protect the next one.", "tempo-test");
  });

  els.exportButton.addEventListener("click", exportData);
  els.importButton.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", importData);

  els.jumpCurrentButton.addEventListener("click", () => {
    selectedDate = dateKey(new Date());
    state.selectedDate = selectedDate;
    els.dateInput.value = selectedDate;
    ensurePriorities(selectedDate);
    saveState();
    renderAll();
    const current = document.querySelector(".hour-row.is-current");
    if (current) current.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  els.focusAlertsToggle.addEventListener("change", () => {
    state.settings.focusAlerts = els.focusAlertsToggle.checked;
    saveState();
    renderAll();
    checkReminderAndAlerts();
  });

  els.thresholdSelect.addEventListener("change", () => {
    state.settings.focusThreshold = Number(els.thresholdSelect.value);
    saveState();
    renderAll();
    checkReminderAndAlerts();
  });

  els.dismissFocusAlert.addEventListener("click", () => {
    dismissedFocusKey = focusAlertKey(selectedDate);
    renderFocusAlert(calcDayStats(selectedDate));
  });

  els.addDayPriority.addEventListener("click", () => addPriority("day"));
  els.addWeekPriority.addEventListener("click", () => addPriority("week"));

  els.resetDayPriorities.addEventListener("click", () => {
    state.priorities.days[selectedDate] = priorityItems(DEFAULT_DAY_PRIORITIES);
    saveState();
    renderPriorities();
  });

  els.resetWeekPriorities.addEventListener("click", () => {
    state.priorities.weeks[weekKey(parseDate(selectedDate))] = priorityItems(DEFAULT_WEEK_PRIORITIES);
    saveState();
    renderPriorities();
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      renderAnalysis();
    });
  });
}

function renderAll() {
  els.todayLabel.textContent = formatLongDate(parseDate(selectedDate));
  els.focusAlertsToggle.checked = Boolean(state.settings.focusAlerts);
  els.thresholdSelect.value = String(state.settings.focusThreshold || 3);
  els.reminderButtonText.textContent = state.settings.reminders ? "Reminders on" : "Enable reminders";
  renderPriorities();
  renderHours();
  renderMetrics();
  renderAnalysis();
}

function renderAuth() {
  const loggedIn = Boolean(state.auth?.loggedIn);

  els.authScreen.classList.toggle("is-hidden", loggedIn);
  els.appShell.classList.toggle("is-hidden", !loggedIn);
  els.userEmailChip.textContent = state.auth?.email || "";
  els.emailInput.value = state.auth?.email || "";

  if (!loggedIn) els.authStatus.textContent = "Your email ID is checked by the local TempoFocus server.";
}

async function loginWithEmail() {
  const email = els.emailInput.value.trim().toLowerCase();

  if (!isValidEmail(email)) {
    els.authStatus.textContent = "Enter a valid email ID.";
    els.emailInput.focus();
    return;
  }

  els.authStatus.textContent = "Logging in...";

  try {
    const data = await loginRequest(email);
    if (!data.ok) throw new Error(data.error || "Login failed.");

    state.auth = {
      ...state.auth,
      loggedIn: true,
      email: data.email || email,
      loggedInAt: new Date().toISOString()
    };
    saveState();
    renderAuth();
    renderAll();
  } catch (error) {
    els.authStatus.textContent = error.message;
    els.emailInput.focus();
  }
}

async function loginRequest(email) {
  if (window.TempoFocusAndroid?.loginWithEmail) {
    return JSON.parse(window.TempoFocusAndroid.loginWithEmail(email));
  }

  if (window.location.protocol === "file:") {
    return { ok: true, email };
  }

  const response = await fetch("api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  return { ...data, ok: response.ok && data.ok };
}

function logout() {
  state.auth = {
    ...state.auth,
    loggedIn: false,
    email: ""
  };
  saveState();
  renderAuth();
  els.emailInput.focus();
}

function renderPriorities() {
  ensurePriorities(selectedDate);
  renderPriorityList(els.dayPriorities, state.priorities.days[selectedDate], "day");
  renderPriorityList(els.weekPriorities, state.priorities.weeks[weekKey(parseDate(selectedDate))], "week");
}

function renderPriorityList(container, items, scope) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "priority-empty";
    empty.textContent = scope === "day" ? "Add today's priorities." : "Add this week's priorities.";
    container.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const node = els.priorityTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector('input[type="checkbox"]');
    const input = node.querySelector(".priority-input");
    const removeButton = node.querySelector(".remove-priority");
    checkbox.checked = Boolean(item.done);
    input.value = item.text;
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      saveState();
      renderMetrics();
    });
    input.addEventListener("input", () => {
      item.text = input.value;
      saveState();
    });
    input.setAttribute("aria-label", `${scope} priority ${index + 1}`);
    input.setAttribute("placeholder", scope === "day" ? "Add a priority for today" : "Add a priority for this week");
    removeButton.addEventListener("click", () => {
      items.splice(index, 1);
      saveState();
      renderPriorities();
      renderMetrics();
    });
    container.append(node);
  });
}

function addPriority(scope) {
  const items = priorityItemsFor(scope);
  items.push({ text: "", done: false });
  saveState();
  renderPriorities();
  const container = scope === "day" ? els.dayPriorities : els.weekPriorities;
  const inputs = container.querySelectorAll(".priority-input");
  inputs[inputs.length - 1]?.focus();
}

function priorityItemsFor(scope) {
  ensurePriorities(selectedDate);
  if (scope === "day") return state.priorities.days[selectedDate];
  return state.priorities.weeks[weekKey(parseDate(selectedDate))];
}

function renderHours() {
  ensureDayLogs(selectedDate);
  els.hourList.replaceChildren();
  const now = new Date();
  const isToday = selectedDate === dateKey(now);
  const currentHour = now.getHours();

  SLOT_HOURS.forEach((hour) => {
    const log = state.logs[selectedDate][hour] || createLog();
    const row = els.hourTemplate.content.firstElementChild.cloneNode(true);
    const category = CATEGORIES[log.category] || CATEGORIES.admin;
    row.dataset.hour = String(hour);
    row.style.borderLeftColor = category.color;
    row.querySelector(".hour-label").textContent = hourLabel(hour);
    row.querySelector(".hour-state").textContent = stateForHour(hour, isToday, currentHour, log);

    if (isToday && hour === currentHour) row.classList.add("is-current");
    if (isWasteLog(log)) row.classList.add("is-waste");
    if (isFocusLog(log)) row.classList.add("is-focus");

    const activityInput = row.querySelector(".activity-input");
    const categorySelect = row.querySelector(".category-select");

    activityInput.value = log.activity || "";
    activityInput.setAttribute("aria-label", `${hourLabel(hour)} activity`);
    populateCategorySelect(categorySelect, log.category);

    const commitActivity = () => {
      updateLog(hour, { activity: activityInput.value });
      refreshHourRowState(row, hour);
    };
    activityInput.addEventListener("input", commitActivity);
    activityInput.addEventListener("change", commitActivity);

    categorySelect.addEventListener("change", () => {
      const nextCategory = CATEGORIES[categorySelect.value];
      updateLog(hour, {
        category: categorySelect.value,
        score: nextCategory.score
      });
      refreshHourRowState(row, hour);
      renderAll();
    });

    els.hourList.append(row);
  });
}

function populateCategorySelect(select, selected) {
  select.replaceChildren();
  Object.entries(CATEGORIES).forEach(([value, meta]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = meta.label;
    option.selected = value === selected;
    select.append(option);
  });
}

function updateLog(hour, patch, shouldRender = true) {
  ensureDayLogs(selectedDate);
  const hourKey = String(hour);
  const previous = state.logs[selectedDate][hourKey] || createLog();
  const nextLog = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  if (isMeaningfulLog(nextLog)) nextLog.loggedAt ||= nextLog.updatedAt;
  state.logs[selectedDate][hourKey] = nextLog;
  saveState();
  if (shouldRender) refreshDashboardAfterLogChange();
}

function refreshDashboardAfterLogChange() {
  renderMetrics();
  renderAnalysis();
  checkReminderAndAlerts();
}

function refreshHourRowState(row, hour) {
  const log = state.logs[selectedDate]?.[String(hour)];
  const now = new Date();
  const isToday = selectedDate === dateKey(now);
  const currentHour = now.getHours();
  const category = CATEGORIES[log?.category] || CATEGORIES.admin;

  row.style.borderLeftColor = category.color;
  row.classList.toggle("is-current", isToday && hour === currentHour);
  row.classList.toggle("is-waste", isWasteLog(log));
  row.classList.toggle("is-focus", isFocusLog(log));
  row.querySelector(".hour-state").textContent = stateForHour(hour, isToday, currentHour, log);
}

function renderMetrics() {
  const stats = calcDayStats(selectedDate);
  const mood = moodForDay(selectedDate, stats.wasteHours);
  els.loggedMetric.textContent = `${stats.logged}/${SLOT_COUNT}`;
  els.focusMetric.textContent = String(stats.focusHours);
  els.wasteMetric.textContent = String(stats.wasteHours);
  els.streakMetric.textContent = String(stats.bestStreak);
  els.moodFace.textContent = mood.face;
  els.moodTitle.textContent = mood.label;
  els.moodDetail.textContent = mood.detail(stats);
  renderFocusAlert(stats);
  syncNativeSummary(stats);
}

function renderFocusAlert(stats) {
  const threshold = state.settings.focusThreshold || 3;
  const shouldShow = state.settings.focusAlerts && stats.wasteHours >= threshold && dismissedFocusKey !== focusAlertKey(selectedDate);
  els.focusAlert.classList.toggle("is-hidden", !shouldShow);
  if (shouldShow) {
    els.focusAlertCopy.textContent = `${stats.wasteHours} wasted hours logged today. Reset the next block.`;
  }
}

function syncNativeSummary(stats) {
  if (!window.TempoFocusAndroid?.syncSummary) return;

  window.TempoFocusAndroid.syncSummary(JSON.stringify({
    date: selectedDate,
    logged: stats.logged,
    focusHours: stats.focusHours,
    wasteHours: stats.wasteHours,
    threshold: state.settings.focusThreshold || 3,
    focusAlerts: Boolean(state.settings.focusAlerts),
    utilization: stats.utilization
  }));
}

function renderAnalysis() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const selected = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  if (activeTab === "daily") renderDailyAnalysis();
  if (activeTab === "weekly") renderWeeklyAnalysis();
  if (activeTab === "monthly") renderMonthlyAnalysis();
}

function renderDailyAnalysis() {
  const stats = calcDayStats(selectedDate);
  renderSummary([
    ["Logged blocks", `${stats.logged}/${SLOT_COUNT}`],
    ["Open blocks", String(SLOT_COUNT - stats.logged)],
    ["Focus hours", String(stats.focusHours)],
    ["Wasted hours", String(stats.wasteHours)]
  ]);

  const totals = categoryTotals(selectedDate);
  const max = Math.max(1, ...Object.values(totals));
  const chart = document.createElement("div");
  chart.className = "bar-list";
  Object.entries(CATEGORIES).forEach(([key, meta]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${meta.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(totals[key] || 0) / max * 100}%; background:${meta.color}"></div></div>
      <strong>${totals[key] || 0}</strong>
    `;
    chart.append(row);
  });
  els.chartShell.replaceChildren(chart);
  renderInsights(dailyInsights(stats));
}

function renderWeeklyAnalysis() {
  const days = lastNDates(parseDate(selectedDate), 7);
  const dailyStats = days.map((day) => ({ key: dateKey(day), label: shortWeekday(day), stats: calcDayStats(dateKey(day)) }));
  const avg = average(dailyStats.map((item) => item.stats.utilization));
  const focus = sum(dailyStats.map((item) => item.stats.focusHours));
  const waste = sum(dailyStats.map((item) => item.stats.wasteHours));
  const logged = sum(dailyStats.map((item) => item.stats.logged));
  const avgLogged = Math.round(logged / dailyStats.length) || 0;

  renderSummary([
    ["Avg logged/day", String(avgLogged)],
    ["Focus hours", String(focus)],
    ["Wasted hours", String(waste)],
    ["Logged blocks", String(logged)]
  ]);

  const chart = document.createElement("div");
  chart.className = "week-bars";
  dailyStats.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = "week-bar";
    const mood = moodForDay(item.key, item.stats.wasteHours);
    bar.innerHTML = `
      <div class="week-bar-fill" style="height:${Math.max(7, item.stats.utilization * 1.65)}px; background:${mood.color}"></div>
      <span>${item.label}</span>
    `;
    chart.append(bar);
  });
  els.chartShell.replaceChildren(chart);
  renderInsights(rangeInsights(avg, focus, waste, "week"));
}

function renderMonthlyAnalysis() {
  const base = parseDate(selectedDate);
  const year = base.getFullYear();
  const month = base.getMonth();
  const dates = datesInMonth(year, month);
  const stats = dates.map((day) => calcDayStats(dateKey(day)));
  const avg = average(stats.map((item) => item.utilization));
  const focus = sum(stats.map((item) => item.focusHours));
  const waste = sum(stats.map((item) => item.wasteHours));
  const logged = sum(stats.map((item) => item.logged));
  const avgLogged = Math.round(logged / stats.length) || 0;

  renderSummary([
    ["Avg logged/day", String(avgLogged)],
    ["Focus hours", String(focus)],
    ["Wasted hours", String(waste)],
    ["Logged blocks", String(logged)]
  ]);

  const chart = document.createElement("div");
  chart.className = "month-heatmap";
  const firstDayOffset = new Date(year, month, 1).getDay();
  for (let index = 0; index < firstDayOffset; index += 1) {
    const empty = document.createElement("div");
    empty.className = "heat-cell is-empty";
    chart.append(empty);
  }
  dates.forEach((day) => {
    const dayStats = calcDayStats(dateKey(day));
    const cell = document.createElement("div");
    cell.className = "heat-cell";
    cell.style.background = heatColor(dayStats.utilization);
    cell.textContent = String(day.getDate());
    cell.title = `${formatShortDate(day)}: ${dayStats.utilization}%`;
    chart.append(cell);
  });
  els.chartShell.replaceChildren(chart);
  renderInsights(rangeInsights(avg, focus, waste, "month"));
}

function renderSummary(items) {
  els.analysisSummary.replaceChildren();
  items.forEach(([label, value]) => {
    const cell = document.createElement("div");
    cell.className = "summary-cell";
    cell.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    els.analysisSummary.append(cell);
  });
}

function renderInsights(items) {
  els.insightList.replaceChildren();
  items.forEach((text) => {
    const item = document.createElement("div");
    item.className = "insight-item";
    item.textContent = text;
    els.insightList.append(item);
  });
}

async function generateCoachAdvice() {
  const payload = buildCoachPayload(selectedDate);
  els.coachButton.disabled = true;
  els.coachOutput.innerHTML = "<p>Thinking through your day...</p>";

  try {
    const advice = await requestCoachAdvice(payload);
    renderCoachAdvice(advice);
  } catch {
    renderCoachAdvice(localCoachAdvice(payload));
  } finally {
    els.coachButton.disabled = false;
  }
}

async function requestCoachAdvice(payload) {
  if (window.location.protocol === "file:" || window.TempoFocusAndroid) {
    return localCoachAdvice(payload);
  }

  const response = await fetch("api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Coach unavailable.");
  return data.advice;
}

function buildCoachPayload(key) {
  ensureDayLogs(key);
  const stats = calcDayStats(key);
  const logs = SLOT_HOURS.map((hour) => {
    const log = state.logs[key][hour];
    return {
      time: hourLabel(hour),
      activity: String(log.activity || "").trim(),
      category: CATEGORIES[log.category]?.label || "Other",
      score: Number(log.score) || 0,
      logged: isLogged(log)
    };
  }).filter((log) => log.logged);

  return {
    date: key,
    stats,
    threshold: state.settings.focusThreshold || 3,
    dayPriorities: (state.priorities.days[key] || []).map((item) => item.text).filter(Boolean),
    weekPriorities: (state.priorities.weeks[weekKey(parseDate(key))] || []).map((item) => item.text).filter(Boolean),
    logs
  };
}

function renderCoachAdvice(advice) {
  const suggestions = Array.isArray(advice.suggestions) ? advice.suggestions : [];
  const summary = advice.summary || "Here is a tighter plan for the next block.";
  const nextBlock = advice.nextBlock || "Pick one small task, set a timer, and log the result.";

  const listItems = suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.coachOutput.innerHTML = `
    <p><strong>${escapeHtml(summary)}</strong></p>
    <ul class="coach-list">${listItems}</ul>
    <p>${escapeHtml(nextBlock)}</p>
  `;
}

function localCoachAdvice(payload) {
  const { stats, logs, dayPriorities } = payload;
  const lowBlocks = logs.filter((log) => log.score < 45);
  const bestBlocks = logs.filter((log) => log.score >= 75);
  const blankCount = SLOT_COUNT - stats.logged;
  const suggestions = [];

  if (!logs.length) {
    suggestions.push("Start by logging the last completed hour honestly, even if it was messy.");
    suggestions.push("Choose one day priority and turn it into a 25-minute next action.");
  } else if (lowBlocks.length) {
    const worst = lowBlocks[0];
    suggestions.push(`${worst.time} looks like the main leak. Name the trigger, then remove it before the next block.`);
    suggestions.push("For the next hour, keep only one tab/app/task open and log the result immediately after.");
  } else {
    suggestions.push("Your logged blocks are not waste-heavy. Protect the pattern by planning the next hour before it starts.");
  }

  if (stats.wasteHours >= (state.settings.focusThreshold || 3)) {
    suggestions.push("You have crossed your focus-alert threshold. Do a reset block: water, desk clear, phone away, one concrete task.");
  }
  if (blankCount > 3) {
    suggestions.push(`${blankCount} blocks are still blank. Fill rough notes first; analysis gets better after the day is visible.`);
  }
  if (bestBlocks.length) {
    suggestions.push(`Repeat what worked in ${bestBlocks[0].time}: same environment, same task shape, fewer decisions.`);
  }
  if (dayPriorities.length) {
    suggestions.push(`Tie the next block to "${dayPriorities[0]}" so the day priority drives the schedule.`);
  }

  return {
    summary: stats.utilization >= 70
      ? "Good momentum. Your main job is to defend the next block."
      : "The day can still be rescued by making the next hour extremely specific.",
    suggestions: suggestions.slice(0, 4),
    nextBlock: "Write one result you want by the end of the next hour, then work only toward that result."
  };
}

function dailyInsights(stats) {
  const insights = [];
  if (stats.logged === 0) {
    insights.push("Start with the last completed hour. One honest entry is enough to get the day moving.");
  } else if (stats.utilization >= 75) {
    insights.push("Strong rhythm. Keep the next block specific and boringly executable.");
  } else if (stats.wasteHours >= (state.settings.focusThreshold || 3)) {
    insights.push("The day needs a reset block. Choose one task, one timer, one clean finish.");
  } else {
    insights.push("The dashboard is warming up. Raise one low block and the daily signal changes fast.");
  }

  if (stats.bestStreak >= 3) insights.push(`${stats.bestStreak} strong blocks in a row. That is the pattern to repeat.`);
  if (stats.missingCompleted > 0) insights.push(`${stats.missingCompleted} completed blocks are still blank.`);
  return insights;
}

function rangeInsights(score, focus, waste, label) {
  const insights = [];
  if (score >= 75) insights.push(`The ${label} is running hot: your recent blocks are looking strong.`);
  if (focus > waste) insights.push(`${focus} focus hours beat ${waste} wasted hours.`);
  if (waste >= 8) insights.push(`${waste} wasted hours are visible now. Good. Visible is fixable.`);
  if (!insights.length) insights.push(`The ${label} needs more logged blocks before patterns get sharp.`);
  return insights;
}

function calcDayStats(key) {
  const date = parseDate(key);
  const logs = state.logs[key] || {};
  const completedSlots = completedSlotCount(date);
  let logged = 0;
  let loggedScore = 0;
  let focusHours = 0;
  let wasteHours = 0;
  let currentStreak = 0;
  let bestStreak = 0;

  SLOT_HOURS.forEach((hour) => {
    const log = logs[hour];
    if (!isLogged(log)) {
      if (hour < START_HOUR + completedSlots) currentStreak = 0;
      return;
    }

    logged += 1;
    loggedScore += Number(log.score) || 0;
    if (isFocusLog(log)) focusHours += 1;
    if (isWasteLog(log)) wasteHours += 1;

    if ((Number(log.score) || 0) >= 75) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  const missingCompleted = Math.max(0, completedSlots - loggedCompletedCount(logs, completedSlots));
  const loggedAverage = logged ? Math.round(loggedScore / logged) : 0;
  const denominator = Math.max(1, completedSlots);
  const completedLoggedScore = completedLoggedScoreSum(logs, completedSlots);
  const utilization = completedSlots
    ? Math.round((completedLoggedScore + missingCompleted * 30) / denominator)
    : loggedAverage;

  return {
    logged,
    focusHours,
    wasteHours,
    bestStreak,
    loggedAverage,
    missingCompleted,
    utilization: clamp(utilization, 0, 100)
  };
}

function completedSlotCount(date) {
  const today = dateKey(new Date());
  const key = dateKey(date);
  if (key < today) return SLOT_COUNT;
  if (key > today) return 0;
  const hour = new Date().getHours();
  return clamp(hour - START_HOUR, 0, SLOT_COUNT);
}

function completedLoggedCount(logs, completedSlots) {
  return SLOT_HOURS.slice(0, completedSlots).filter((hour) => isLogged(logs[hour])).length;
}

function completedLoggedScoreSum(logs, completedSlots) {
  return SLOT_HOURS.slice(0, completedSlots).reduce((total, hour) => {
    const log = logs[hour];
    return total + (isLogged(log) ? Number(log.score) || 0 : 0);
  }, 0);
}

function categoryTotals(key) {
  const totals = Object.fromEntries(Object.keys(CATEGORIES).map((category) => [category, 0]));
  Object.values(state.logs[key] || {}).forEach((log) => {
    if (isLogged(log) && totals[log.category] !== undefined) totals[log.category] += 1;
  });
  return totals;
}

function moodForDay(dateKey, wastedHours) {
  const date = new Date(dateKey);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (!isWeekend && wastedHours > 4) {
    return {
      face: ":(",
      label: "Rough",
      color: "#d94b3d",
      detail: (stats) => `${stats.wasteHours} wasted hours and ${stats.missingCompleted} blanks need attention.`
    };
  }
  if (wastedHours > 2) {
    return {
      face: ":|",
      label: "Okay",
      color: "#f2b84b",
      detail: (stats) => `${stats.logged}/${SLOT_COUNT} blocks logged. Keep tightening the next hour.`
    };
  }
  return {
    face: ":)",
    label: "Great",
    color: "#5aa469",
    detail: (stats) => `${stats.focusHours} focus hours and ${stats.bestStreak} best streak.`
  };
}

async function enableReminders() {
  if (!("Notification" in window)) {
    state.settings.reminders = false;
    saveState();
    renderAll();
    return;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  state.settings.reminders = permission === "granted";
  state.settings.focusAlerts = state.settings.focusAlerts || permission === "granted";
  saveState();
  renderAll();

  if (permission === "granted") {
    notify("Reminders on", "TempoFocus will ping you to log completed blocks.", "tempo-enabled");
  }
}

function checkReminderAndAlerts() {
  const now = new Date();
  const today = dateKey(now);
  const hour = now.getHours();
  const previousSlot = hour - 1;

  if (state.settings.reminders && previousSlot >= START_HOUR && previousSlot < END_HOUR) {
    const reminderKey = `${today}-${previousSlot}`;
    const log = state.logs[today]?.[previousSlot];
    if (state.lastReminderKey !== reminderKey && !isLogged(log)) {
      state.lastReminderKey = reminderKey;
      saveState();
      notify("Log your hour", `${hourLabel(previousSlot)} is ready for a quick entry.`, reminderKey);
    }
  }

  if (state.settings.focusAlerts) {
    const stats = calcDayStats(today);
    const threshold = state.settings.focusThreshold || 3;
    const alertKey = `${today}-${Math.floor(stats.wasteHours)}`;
    if (stats.wasteHours >= threshold && state.lastFocusAlertKey !== alertKey) {
      state.lastFocusAlertKey = alertKey;
      saveState();
      notify("Focus reset", `${stats.wasteHours} wasted hours so far. Make the next block count.`, alertKey);
    }
  }
}

async function notify(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options = {
    body,
    tag,
    badge: "assets/rhythm-mark.svg",
    icon: "assets/rhythm-mark.svg"
  };
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration?.showNotification) {
    registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}

function loadState() {
  const fallback = {
    logs: {},
    priorities: { days: {}, weeks: {} },
    settings: { reminders: false, focusAlerts: false, focusThreshold: 3 },
    auth: {
      loggedIn: false,
      email: ""
    },
    selectedDate: dateKey(new Date()),
    lastReminderKey: "",
    lastFocusAlertKey: ""
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...fallback,
      ...parsed,
      priorities: {
        days: parsed.priorities?.days || {},
        weeks: parsed.priorities?.weeks || {}
      },
      settings: {
        ...fallback.settings,
        ...(parsed.settings || {})
      },
      auth: {
        ...fallback.auth,
        ...(parsed.auth || {}),
        email: parsed.auth?.email || "",
        loggedIn: Boolean(parsed.auth?.loggedIn && parsed.auth?.email)
      }
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensurePriorities(key) {
  const week = weekKey(parseDate(key));
  state.priorities.days[key] ||= priorityItems(DEFAULT_DAY_PRIORITIES);
  state.priorities.weeks[week] ||= priorityItems(DEFAULT_WEEK_PRIORITIES);
  ensureDayLogs(key);
}

function ensureDayLogs(key) {
  state.logs[key] ||= {};
  SLOT_HOURS.forEach((hour) => {
    state.logs[key][hour] ||= createLog();
  });
}

function createLog() {
  return {
    activity: "",
    category: "admin",
    score: CATEGORIES.admin.score,
    loggedAt: "",
    updatedAt: ""
  };
}

function priorityItems(values) {
  return values.map((text) => ({ text, done: false }));
}

function isMeaningfulLog(log) {
  if (!log) return false;
  const activity = String(log.activity || "").trim();
  const score = Number(log.score);
  return Boolean(
    activity ||
    log.loggedAt ||
    (log.category && log.category !== "admin") ||
    (Number.isFinite(score) && score !== CATEGORIES.admin.score)
  );
}

function isLogged(log) {
  return Boolean(log && (isMeaningfulLog(log) || log.updatedAt));
}

function isWasteLog(log) {
  if (!isLogged(log)) return false;
  return CATEGORIES[log.category]?.waste || Number(log.score) < 40;
}

function isFocusLog(log) {
  if (!isLogged(log)) return false;
  return CATEGORIES[log.category]?.focus || Number(log.score) >= 75;
}

function stateForHour(hour, isToday, currentHour, log) {
  if (isToday && hour === currentHour) return "now";
  if (isLogged(log)) return isWasteLog(log) ? "reset" : "logged";
  if (isToday && hour < currentHour) return "blank";
  return "open";
}

function focusAlertKey(key) {
  return `${key}-${state.settings.focusThreshold || 3}`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tempo-focus-${dateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      Object.assign(state, loadImportedState(parsed));
      selectedDate = state.selectedDate || dateKey(new Date());
      els.dateInput.value = selectedDate;
      saveState();
      renderAuth();
      renderAll();
    } catch {
      notify("Import failed", "The selected file was not valid TempoFocus data.", "tempo-import-failed");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function loadImportedState(parsed) {
  return {
    logs: parsed.logs || {},
    priorities: {
      days: parsed.priorities?.days || {},
      weeks: parsed.priorities?.weeks || {}
    },
    settings: {
      reminders: Boolean(parsed.settings?.reminders),
      focusAlerts: Boolean(parsed.settings?.focusAlerts),
      focusThreshold: Number(parsed.settings?.focusThreshold) || 3
    },
    auth: {
      loggedIn: Boolean(parsed.auth?.loggedIn),
      email: parsed.auth?.email || "",
      loggedInAt: parsed.auth?.loggedInAt || ""
    },
    selectedDate: parsed.selectedDate || dateKey(new Date()),
    lastReminderKey: parsed.lastReminderKey || "",
    lastFocusAlertKey: parsed.lastFocusAlertKey || ""
  };
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("service-worker.js");
    } catch {
      /* Local file previews cannot register service workers. */
    }
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function weekKey(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekOne = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target - weekOne) / 86400000 - 3 + ((weekOne.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hourLabel(hour) {
  return `${formatHour(hour)}-${formatHour(hour + 1)}`;
}

function formatHour(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const value = hour % 12 || 12;
  return `${value} ${period}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function shortWeekday(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function lastNDates(endDate, count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (count - 1 - index));
    return date;
  });
}

function datesInMonth(year, month) {
  const dates = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length ? Math.round(sum(filtered) / filtered.length) : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function heatColor(score) {
  if (score >= 75) return "#caead3";
  if (score >= 50) return "#f8e5b7";
  if (score > 0) return "#f8c6bd";
  return "#eef4f1";
}
