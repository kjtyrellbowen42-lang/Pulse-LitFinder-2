// app.js
import app, { auth, db, firebaseConfig } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// UI elements
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const verifyBtn = document.getElementById("verify-btn");
const userNameEl = document.getElementById("user-name");
const userEmailEl = document.getElementById("user-email");
const createPanel = document.getElementById("create-panel");
const openCreateBtn = document.getElementById("open-create");
const openEventsBtn = document.getElementById("open-events");
const eventsListEl = document.getElementById("events-list");
const mapEl = document.getElementById("map");
const searchInput = document.getElementById("search");
const nearbyRadiusEl = document.getElementById("nearby-radius");

const filterAllBtn = document.getElementById("filter-all");
const filterNearbyBtn = document.getElementById("filter-nearby");
const filterPromotedBtn = document.getElementById("filter-promoted");
const filterMineBtn = document.getElementById("filter-mine");
const filterUpcomingBtn = document.getElementById("filter-upcoming");

const quickCreateBtn = document.getElementById("quick-create");
const quickNameEl = document.getElementById("quick-name");
const quickLocationEl = document.getElementById("quick-location");

const detailArea = document.getElementById("detail-area");
const partyDetail = document.getElementById("party-detail");
const noSelection = document.getElementById("no-selection");

const detailNameEl = document.getElementById("detail-name");
const detailMeta = document.getElementById("detail-meta");
const detailLocationEl = document.getElementById("detail-location");

const btnJoin = document.getElementById("btn-join");
const btnMessage = document.getElementById("btn-message");
const btnPromote = document.getElementById("btn-promote");
const btnReport = document.getElementById("btn-report");
const hostControls = document.getElementById("host-controls");
const btnEdit = document.getElementById("btn-edit");
const btnDelete = document.getElementById("btn-delete");
const btnTogglePromote = document.getElementById("btn-toggle-promote");

const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

// create/edit controls
const eventNameEl = document.getElementById("event-name");
const eventLocationEl = document.getElementById("event-location");
const eventLatEl = document.getElementById("event-lat");
const eventLngEl = document.getElementById("event-lng");
const eventTimeEl = document.getElementById("event-time");
const saveEventBtn = document.getElementById("save-event");
const cancelCreateBtn = document.getElementById("cancel-create");

// host dashboard and other controls
const hostDashboard = document.getElementById("host-dashboard");
const manageEventsBtn = document.getElementById("manage-my-events");

// map & markers
const map = L.map("map").setView([37.7749, -122.4194], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let eventMarkers = {};
let userMarkers = {};
let cachedEvents = [];
let selectedEvent = null;
let currentUserDoc = null;
let watchId = null;

// Basic helpers
const escapeHtml = s => String(s ?? "").replace(/[&<>"'`=\/]/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;","/":"&#x2F;","`":"&#x60;","=":"&#x3D;"
})[ch]);

function show(el){ el.classList.remove("hidden") }
function hide(el){ el.classList.add("hidden") }

// -----------------------------
// Authentication flows
// -----------------------------
loginBtn.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) return alert("Enter email and password.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

signupBtn.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) return alert("Enter email and password.");
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    // Create user document for roles and safety verification
    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      role: "user", // default role
      verified: false,
      createdAt: serverTimestamp()
    });
    // send email verification
    await sendEmailVerification(userCred.user);
    alert("Account created — verification email sent. Check your inbox.");
  } catch (err) {
    alert("Signup failed: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// resend verification
verifyBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Not signed in");
  try {
    await sendEmailVerification(auth.currentUser);
    alert("Verification email resent.");
  } catch (err) { alert(err.message); }
});

// On auth state changed
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // refresh user doc
    const udoc = await getDoc(doc(db, "users", user.uid));
    currentUserDoc = udoc.exists() ? udoc.data() : null;
    userNameEl.textContent = currentUserDoc?.displayName || user.email.split("@")[0] || "User";
    userEmailEl.textContent = user.email + (user.emailVerified ? " ✅" : " (unverified)");
    show(logoutBtn);
    show(verifyBtn);
    if (user.emailVerified) { verifyBtn.classList.add("hidden"); }
    // show host dashboard if role host/admin
    if (currentUserDoc?.role === "host" || currentUserDoc?.role === "admin") show(hostDashboard);
    else hide(hostDashboard);

    // start publishing location (if allowed)
    startPublishingLocation(user.uid);

  } else {
    userNameEl.textContent = "Not signed in";
    userEmailEl.textContent = "";
    hide(logoutBtn);
    hide(verifyBtn);
    hide(hostDashboard);
    stopPublishingLocation();
  }
});

// -----------------------------
// User location publish (locations collection)
// -----------------------------
async function startPublishingLocation(uid) {
  if (!navigator.geolocation) return;
  if (watchId !== null) return; // already watching
  watchId = navigator.geolocation.watchPosition(async pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    await setDoc(doc(db, "locations", uid), {
      uid, lat, lng, updated: serverTimestamp()
    }, { merge: true });
  }, err => {
    console.warn("Geolocation error:", err);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
}
function stopPublishingLocation(){
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
}

// listen to other users' locations
onSnapshot(collection(db, "locations"), snapshot => {
  snapshot.docChanges().forEach(change => {
    const id = change.doc.id;
    const d = change.doc.data();
    if (change.type === "removed") {
      if (userMarkers[id]) { map.removeLayer(userMarkers[id]); delete userMarkers[id]; }
      return;
    }
    if (d.lat && d.lng) {
      if (!userMarkers[id]) userMarkers[id] = L.marker([d.lat, d.lng], { title: d.uid }).addTo(map);
      else userMarkers[id].setLatLng([d.lat, d.lng]);
    }
  });
});

// -----------------------------
// Events CRUD & real-time feed
// -----------------------------
const eventsCol = collection(db, "events");
const eventsQuery = query(eventsCol, orderBy("createdAt","desc"));

// real-time events
onSnapshot(eventsQuery, snapshot => {
  cachedEvents = snapshot.docs;
  renderEventList();
}, err => console.error("Events snapshot error:", err));

function renderEventList(filter = {}) {
  // filter object can include nearby coords, promoted etc
  eventsListEl.innerHTML = "";
  // clear markers
  Object.values(eventMarkers).forEach(m => map.removeLayer(m));
  eventMarkers = {};

  const q = cachedEvents.filter(d => {
    const data = d.data();
    // basic search
    const text = (data.name + " " + (data.locationLabel||"")).toLowerCase();
    if (searchInput.value && !text.includes(searchInput.value.toLowerCase())) return false;
    if (filter.promoted && !data.promoted) return false;
    if (filter.mine && auth.currentUser && data.owner !== auth.currentUser.uid) return false;
    if (filter.upcoming && data.time) {
      const t = new Date(data.time).getTime();
      if (t < Date.now()) return false;
    }
    if (filter.nearby && filter.lat && filter.lng && data.lat && data.lng) {
      const dkm = haversineKm(filter.lat, filter.lng, data.lat, data.lng);
      return dkm <= (filter.radiusKm || 5);
    }
    return true;
  });

  q.forEach(docSnap => {
    const id = docSnap.id;
    const d = docSnap.data();
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <strong>${escapeHtml(d.name)}</strong>
      <div class="muted small">${escapeHtml(d.locationLabel || "")} • ${d.time ? new Date(d.time).toLocaleString() : "—"}</div>
    `;
    card.addEventListener("click", () => selectEvent(id));
    eventsListEl.appendChild(card);

    // map marker
    if (d.lat && d.lng) {
      const mk = L.marker([d.lat, d.lng]).addTo(map).bindPopup(`${escapeHtml(d.name)}<br>${escapeHtml(d.locationLabel||"")}`);
      eventMarkers[id] = mk;
    }
  });
}

// utility: haversine
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// selection, detail load and chat wiring
async function selectEvent(eventId) {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return alert("Event not found");
  selectedEvent = { id: snap.id, ...snap.data() };
  showDetail(selectedEvent);
}

function showDetail(eventObj) {
  hide(noSelection);
  show(partyDetail);
  detailNameEl.textContent = eventObj.name;
  detailMeta.textContent = `${eventObj.locationLabel || "—"} · ${eventObj.time ? new Date(eventObj.time).toLocaleString() : "—"}`;
  detailLocationEl.textContent = `Coordinates: ${eventObj.lat ?? "—"}, ${eventObj.lng ?? "—"}`;

  // CTA buttons:
  show(btnJoin); show(btnMessage); show(btnPromote); show(btnReport);

  // host controls if current user is owner or admin
  if (auth.currentUser && (auth.currentUser.uid === eventObj.owner || (currentUserDoc && currentUserDoc.role === "admin"))) {
    show(hostControls);
  } else hide(hostControls);

  // chat: subscribe to messages subcollection
  subscribeChat(eventObj.id);
}

// chat implementation: messages subcollection at events/{id}/messages
let chatUnsub = null;
function subscribeChat(eventId) {
  if (chatUnsub) chatUnsub(); // detach previous
  chatWindow.innerHTML = "<small class='muted'>Loading chat...</small>";

  const messagesQ = query(collection(db, `events/${eventId}/messages`), orderBy("createdAt","asc"));
  chatUnsub = onSnapshot(messagesQ, snap => {
    chatWindow.innerHTML = "";
    snap.docs.forEach(doc => {
      const m = doc.data();
      const el = document.createElement("div");
      el.className = "chat-message";
      el.innerHTML = `<div class="muted small">${escapeHtml(m.senderName||m.sender||"")}</div><div>${escapeHtml(m.text)}</div>`;
      chatWindow.appendChild(el);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, err => {
    chatWindow.innerHTML = "<div class='muted'>Chat error</div>";
    console.error(err);
  });
}

// send chat
chatSend.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to chat");
  if (!selectedEvent) return alert("Select an event");
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    await addDoc(collection(db, `events/${selectedEvent.id}/messages`), {
      text,
      sender: auth.currentUser.uid,
      senderName: currentUserDoc?.displayName || auth.currentUser.email.split("@")[0],
      createdAt: serverTimestamp()
    });
    chatInput.value = "";
  } catch (err) { alert(err.message); }
});

// CTA handlers: join, message, promote, report
btnJoin.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to join");
  try {
    await addDoc(collection(db, `events/${selectedEvent.id}/attendees`), {
      uid: auth.currentUser.uid,
      joinedAt: serverTimestamp()
    });
    alert("You've joined — check the event chat!");
  } catch (err) { alert(err.message); }
});

btnMessage.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to message host");
  // open chat and prefill a message to host (create DM? here we prompt in chat)
  chatInput.value = `@host Hi, I'm interested in ${selectedEvent.name}`;
});

btnPromote.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to request promotion");
  // simple promotion request: create document in "promotions" for admins to review
  try {
    await addDoc(collection(db, "promotions"), {
      eventId: selectedEvent.id,
      requester: auth.currentUser.uid,
      requestedAt: serverTimestamp(),
      status: "pending"
    });
    alert("Promotion request submitted — admin will review.");
  } catch (err) { alert(err.message); }
});

btnReport.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to report");
  const reason = prompt("Describe the issue (brief):");
  if (!reason) return;
  try {
    await addDoc(collection(db, "reports"), {
      eventId: selectedEvent.id,
      reporter: auth.currentUser.uid,
      reason,
      createdAt: serverTimestamp()
    });
    alert("Report submitted. Thank you.");
  } catch (err) { alert(err.message); }
});

// host controls
btnDelete.addEventListener("click", async () => {
  if (!confirm("Delete this event?")) return;
  try {
    await deleteDoc(doc(db, "events", selectedEvent.id));
    alert("Deleted");
    selectedEvent = null;
    hide(partyDetail);
    show(noSelection);
  } catch (err) { alert(err.message); }
});

btnEdit.addEventListener("click", () => {
  // open create panel and populate
  showCreateForEdit(selectedEvent);
});

btnTogglePromote.addEventListener("click", async () => {
  try {
    await updateDoc(doc(db, "events", selectedEvent.id), { promoted: !selectedEvent.promoted });
    alert("Toggled promotion");
  } catch (err) { alert(err.message); }
});

// quick create
quickCreateBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to create");
  const name = quickNameEl.value.trim();
  const locationLabel = quickLocationEl.value.trim();
  if (!name || !locationLabel) return alert("Provide name & location");
  try {
    await addDoc(collection(db, "events"), {
      name, locationLabel, lat: null, lng: null, time: null,
      createdAt: serverTimestamp(), owner: auth.currentUser.uid, promoted: false
    });
    quickNameEl.value = ""; quickLocationEl.value = "";
    alert("Created");
  } catch (err) { alert(err.message); }
});

// Create / Edit save
saveEventBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Login to create");
  const name = eventNameEl.value.trim();
  const locationLabel = eventLocationEl.value.trim();
  const lat = parseFloat(eventLatEl.value) || null;
  const lng = parseFloat(eventLngEl.value) || null;
  const time = eventTimeEl.value || null;
  if (!name || !locationLabel) return alert("Name and location required");
  // if editing selectedEvent and user is owner -> update
  try {
    if (selectedEvent && auth.currentUser.uid === selectedEvent.owner) {
      await updateDoc(doc(db, "events", selectedEvent.id), { name, locationLabel, lat, lng, time });
      alert("Updated");
    } else {
      await addDoc(collection(db, "events"), {
        name, locationLabel, lat, lng, time, createdAt: serverTimestamp(), owner: auth.currentUser.uid, promoted: false
      });
      alert("Created");
    }
    // hide create panel
    hide(createPanel); show(partyDetail);
  } catch (err) { alert(err.message); }
});

cancelCreateBtn.addEventListener("click", () => { hide(createPanel); show(partyDetail); });

// open create
openCreateBtn.addEventListener("click", () => {
  show(createPanel); hide(partyDetail); hide(noSelection);
});

// search and filters
filterAllBtn.addEventListener("click", () => { clearFilterChips(); filterAllBtn.classList.add("active"); renderEventList(); });
filterPromotedBtn.addEventListener("click", () => { clearFilterChips(); filterPromotedBtn.classList.add("active"); renderEventList({promoted:true}); });
filterMineBtn.addEventListener("click", () => { clearFilterChips(); filterMineBtn.classList.add("active"); renderEventList({mine:true}); });
filterUpcomingBtn.addEventListener("click", () => { clearFilterChips(); filterUpcomingBtn.classList.add("active"); renderEventList({upcoming:true}); });

filterNearbyBtn.addEventListener("click", async () => {
  clearFilterChips(); filterNearbyBtn.classList.add("active");
  if (!auth.currentUser) return alert("Login to filter by nearby");
  // obtain user's published location
  const locSnap = await getDoc(doc(db, "locations", auth.currentUser.uid));
  if (!locSnap.exists()) return alert("Your location not published. Allow location & reload.");
  const loc = locSnap.data();
  const radius = parseFloat(nearbyRadiusEl.value) || 5;
  renderEventList({ nearby:true, lat:loc.lat, lng:loc.lng, radiusKm:radius });
});

function clearFilterChips(){
  [filterAllBtn, filterNearbyBtn, filterPromotedBtn, filterMineBtn, filterUpcomingBtn].forEach(b => b.classList.remove("active"));
}

// select to edit mode
function showCreateForEdit(ev) {
  show(createPanel);
  hide(partyDetail);
  eventNameEl.value = ev.name || "";
  eventLocationEl.value = ev.locationLabel || "";
  eventLatEl.value = ev.lat ?? "";
  eventLngEl.value = ev.lng ?? "";
  eventTimeEl.value = ev.time ?? "";
}

// admin manage events
manageEventsBtn?.addEventListener("click", () => {
  // open events list
  openEventsBtn.click();
});

// -----------------------------
// Render helpers used by real-time snapshot above
// -----------------------------
function renderEventList(filter = {}) {
  // reuse previously defined renderEventList function (but simple)
  // We'll compute locally for simplicity:
  eventsListEl.innerHTML = "";
  Object.values(eventMarkers).forEach(m => map.removeLayer(m));
  eventMarkers = {};
  const list = cachedEvents.filter(d => {
    const data = d.data();
    if (filter.promoted && !data.promoted) return false;
    if (filter.mine && auth.currentUser && data.owner !== auth.currentUser.uid) return false;
    if (filter.upcoming && data.time && new Date(data.time).getTime() < Date.now()) return false;
    if (filter.nearby && filter.lat && filter.lng && data.lat && data.lng) {
      return haversineKm(filter.lat, filter.lng, data.lat, data.lng) <= (filter.radiusKm || 5);
    }
    if (searchInput.value) {
      const text = (data.name + " " + (data.locationLabel||"")).toLowerCase();
      if (!text.includes(searchInput.value.toLowerCase())) return false;
    }
    return true;
  });

  list.forEach(docSnap => {
    const id = docSnap.id;
    const d = docSnap.data();
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `<strong>${escapeHtml(d.name)}</strong><div class="muted small">${escapeHtml(d.locationLabel||"")} • ${d.time ? new Date(d.time).toLocaleString() : "—"}</div>`;
    card.addEventListener("click", () => selectEvent(id));
    eventsListEl.appendChild(card);

    if (d.lat && d.lng) {
      const mk = L.marker([d.lat, d.lng]).addTo(map).bindPopup(`${escapeHtml(d.name)}<br>${escapeHtml(d.locationLabel||"")}`);
      eventMarkers[id] = mk;
    }
  });
}

// -----------------------------
// Firestore rules required (see below) — ensure you deploy them
// -----------------------------

// Expose some helpful debugging tools
window._LitFinder = { auth, db, firebaseConfig };

// initial instructions: ensure email/password login enabled, authorized domains set, firestore rules deployed.
console.log("LitFinder loaded. Ensure Authentication: Email/Password enabled and your domain authorized in Firebase console.");
