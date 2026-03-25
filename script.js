
const API_BASE = '';

const debugBanner = document.getElementById('debugBanner');
function showError(msg) { if (debugBanner) { debugBanner.style.display = 'block'; debugBanner.textContent = msg; } console.error(msg); }
window.onerror = (m, s, l, c, e) => { showError('Error: ' + m + ' at ' + s + ':' + l); };

// DB Collections: 'events', 'students', 'registrations'

// --- HELPER: Async Storage Wrapper ---
// Because we are moving from Sync (localStorage) to Async (Firestore),
// we need to update how we fetch data.

let globalEvents = []; // Cache events
let globalUser = null; // Cache current user
let currentEventIdToRegister = null;
let currentEventToRegister = null;  // full event object for confirmation email
let currentAdminViewEventId = null;

// --- Theme Toggle logic ---
let currentTheme = localStorage.getItem('ce_theme') || 'dark';
if (currentTheme === 'light') document.body.classList.add('light-theme');

function toggleTheme() {
  const btn = document.getElementById('themeToggleBtn');
  if (document.body.classList.contains('light-theme')) {
    document.body.classList.remove('light-theme');
    localStorage.setItem('ce_theme', 'dark');
    if (btn) btn.textContent = '☀️';
  } else {
    document.body.classList.add('light-theme');
    localStorage.setItem('ce_theme', 'light');
    if (btn) btn.textContent = '🌙';
  }
}
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggleBtn');
    if (currentTheme === 'light' && btn) btn.textContent = '🌙';
    else if (btn) btn.textContent = '☀️';
});
async function loadEvents() {
  try {
    const snapshot = await db.collection("events").get();
    globalEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return globalEvents;
  } catch (error) {
    console.error("Error loading events:", error);
    return [];
  }
}

async function addEventToDB(eventData) {
  try {
    await db.collection("events").add(eventData);
    await loadEvents(); // Refresh cache
    return true;
  } catch (error) {
    showError("Firestore Error: " + error.message);
    return false;
  }
}

async function deleteEventFromDB(eventId) {
  try {
    await db.collection("events").doc(eventId).delete();
    await loadEvents();
    return true;
  } catch (error) {
    showError("Firestore Error: " + error.message);
    return false;
  }
}

// registrations: collection 'registrations'
// Documents will be auto-generated ID, fields: { email, eventId, details: {...} }

async function getRegistrationsForStudent(email) {
  try {
    const q = await db.collection("registrations").where("email", "==", email).get();
    return q.docs.map(doc => doc.data().eventId);
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function registerForEvent(email, eventId, details) {
  try {
    // Check if valid event
    // Add to 'registrations'
    await db.collection("registrations").add({
      email,
      eventId,
      details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (e) {
    showError("Registration Error: " + e.message);
    return false;
  }
}

// Auth Logic (Simple Firestore-based for now, to keep structure similar)
// In a real app, use firebase.auth()!
// We will use the 'students' collection to store simple credentials for this demo.

function getCurrentStudent() {
  const u = localStorage.getItem('ce_current_student_v1');
  return u ? JSON.parse(u) : null;
}
function setCurrentStudent(student) {
  if (student) localStorage.setItem('ce_current_student_v1', JSON.stringify(student));
  else localStorage.removeItem('ce_current_student_v1');
}
function isStudentLogged() { return !!getCurrentStudent(); }

// update student area: show signup/login when logged out, show logout when logged in

function updateStudentSection() {
  const logged = isStudentLogged();

  const authContainer = document.getElementById('authContainer');
  const logoutCard = document.getElementById('studentLogoutCard');
  const navDashBtn = document.getElementById('navDashboardBtn');

  if (logged) {
    if (authContainer) authContainer.style.display = 'none';
    const email = getCurrentStudent().email;
    document.getElementById('currentStudentEmail').textContent = email;
    logoutCard.style.display = 'block';
    if(navDashBtn) navDashBtn.style.display = 'inline-block';
  } else {
    logoutCard.style.display = 'none';
    if(navDashBtn) navDashBtn.style.display = 'none';
    if (authContainer) {
      authContainer.style.display = 'block';
      authContainer.classList.remove("right-panel-active"); // reset
    }
    document.getElementById('studentMsg').textContent = '';
    document.getElementById('signupMsg').textContent = '';
    // Reset Google sign-up step
    resetSignupForm();
  }
}

function resetSignupForm() {
  googleVerifiedEmail = null;

  // Show/hide sections
  const gStep = document.getElementById('googleVerifyStep');
  const pStep = document.getElementById('passwordSetupStep');
  if (gStep) gStep.style.display = 'block';
  if (pStep) pStep.style.display = 'none';

  // Reset Gmail fields
  const suGmail = document.getElementById('su-gmail');
  if (suGmail) suGmail.value = '';
  const gMsg = document.getElementById('googleVerifyMsg');
  if (gMsg) { gMsg.textContent = ''; gMsg.style.color = ''; }
  const gBtn = document.getElementById('googleSignInBtn');
  if (gBtn) { gBtn.disabled = false; gBtn.textContent = 'Verify Gmail & Get OTP'; }

  // Reset OTP/password fields
  const suEmail = document.getElementById('su-email');
  if (suEmail) suEmail.value = '';
  const suOtp = document.getElementById('su-otp');
  if (suOtp) { suOtp.value = ''; suOtp.style.display = 'none'; }
  const suPass = document.getElementById('su-pass');
  if (suPass) suPass.value = '';
  const getOtpBtn = document.getElementById('getOtpBtn');
  if (getOtpBtn) { getOtpBtn.style.display = 'inline-block'; getOtpBtn.textContent = 'Send OTP to Gmail'; getOtpBtn.disabled = false; }
  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) signupBtn.disabled = true;
  generatedOTP = null;
  otpEmail = null;
}

// --- SLIDING AUTH LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const signUpButton = document.getElementById('signUpGhost');
  const signInButton = document.getElementById('signInGhost');
  const container = document.getElementById('authContainer');
  const mobileSignUp = document.getElementById('mobileSignUpLink');
  const mobileSignIn = document.getElementById('mobileSignInLink');

  if (signUpButton && container) {
    signUpButton.addEventListener('click', () => {
      container.classList.add("right-panel-active");
    });
  }

  if (signInButton && container) {
    signInButton.addEventListener('click', () => {
      container.classList.remove("right-panel-active");
    });
  }

  // Mobile toggles
  if (mobileSignUp && container) {
    mobileSignUp.addEventListener('click', (e) => {
      e.preventDefault();
      container.classList.add("right-panel-active");
    });
  }
  if (mobileSignIn && container) {
    mobileSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      container.classList.remove("right-panel-active");
    });
  }
});

// render
async function renderEvents(containerId = 'eventsList') {
  const el = document.getElementById(containerId);
  el.innerHTML = '<p class="muted">Loading events...</p>';

  const events = await loadEvents();

  // Clear immediately before rendering to prevent duplicates from rapid calls
  el.innerHTML = '';

  if (!events.length) { el.innerHTML = '<div class="card empty-state"><p>No events found.</p></div>'; return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentStudent = getCurrentStudent();

  // Prefetch registrations for current user to avoid N+1 queries
  let myRegs = [];
  if (currentStudent) {
    myRegs = await getRegistrationsForStudent(currentStudent.email);
  }

  events.forEach(async (ev) => {
    const a = document.createElement('div'); a.className = 'card';
    let img = ev.image ? `<img src="${ev.image}" class="event-img">` : '';

    // College badge
    let collegeBadge = '';
    if (ev.collegeName || ev.collegeLogo) {
      const logoHtml = ev.collegeLogo ? `<img src="${ev.collegeLogo}" class="event-college-logo" alt="College Logo" />` : '';
      const nameHtml = ev.collegeName ? `<span class="event-college-name">${ev.collegeName}</span>` : '';
      collegeBadge = `<div class="event-college-badge">${logoHtml}${nameHtml}</div>`;
    }

    // Seats badge placeholder — will be filled after async count
    const maxReg = ev.maxRegistrations ? parseInt(ev.maxRegistrations) : null;
    const seatsBadgeId = `seats-badge-${containerId}-${ev.id}`;
    const seatsBadgeHtml = maxReg ? `<span class="seats-badge" id="${seatsBadgeId}">⏳ checking seats…</span>` : '';

    a.innerHTML = `${collegeBadge}<h3>${ev.title}</h3><div class="muted">📅 ${ev.date} · 📍 ${ev.venue}</div>${seatsBadgeHtml}<p class="muted">${ev.desc || ''}</p>${img}`;
    const actions = document.createElement('div'); actions.style.marginTop = '10px';

    // determine if event is today or future
    const evDate = new Date(ev.date + 'T00:00:00'); evDate.setHours(0, 0, 0, 0);
    const isFutureOrToday = evDate.getTime() >= today.getTime();

    if (containerId === 'eventsList') {
      if (isFutureOrToday) {
        const reg = document.createElement('button'); reg.className = 'btn primary';
        const already = myRegs.includes(ev.id);

        if (already) {
          reg.textContent = '✅ Registered';
          reg.disabled = true;
        } else {
          reg.textContent = 'Register Now';
        }

        reg.onclick = async () => {
          if (!isStudentLogged()) { alert('Please login as a student to register.'); showView('student'); return; }
          // Verify again freshly
          const freshRegs = await getRegistrationsForStudent(getCurrentStudent().email);
          if (freshRegs.includes(ev.id)) { alert('You are already registered.'); return; }

          // Live seat check before opening form
          if (maxReg) {
            const countSnap = await db.collection('registrations').where('eventId', '==', ev.id).get();
            if (countSnap.size >= maxReg) {
              alert('Sorry, this event is now full!');
              reg.textContent = 'Full 🚫';
              reg.disabled = true;
              return;
            }
          }

          // Open registration form
          currentEventIdToRegister = ev.id;
          currentEventToRegister = ev;   // save full event for confirmation email
          document.getElementById('regEventTitle').textContent = ev.title;
          // clear previous inputs
          document.getElementById('r-name').value = '';
          document.getElementById('r-regno').value = '';
          document.getElementById('r-college').value = '';
          document.getElementById('r-sem').value = '';
          // clear project fields
          document.getElementById('r-course').value = '';
          document.getElementById('r-course-other').value = '';
          document.getElementById('r-course-other').style.display = 'none';
          document.getElementById('r-project-name').value = '';
          document.getElementById('r-type-individual').checked = true;
          document.getElementById('groupMembersSection').style.display = 'none';
          // reset group members list to single empty row
          document.getElementById('groupMembersList').innerHTML = `
            <div class="group-member-row">
              <input placeholder="Member 2 — Full Name" class="member-name" />
              <input placeholder="Register Number" class="member-regno" />
            </div>`;

          showView('eventRegistration');
        };
        actions.appendChild(reg);

        // Async: fetch registration count and update badge + button
        if (maxReg) {
          db.collection('registrations').where('eventId', '==', ev.id).get().then(snap => {
            const count = snap.size;
            const remaining = maxReg - count;
            const badge = document.getElementById(seatsBadgeId);
            if (badge) {
              if (remaining <= 0) {
                badge.textContent = '🚫 Full';
                badge.className = 'seats-badge seats-full';
              } else if (remaining <= Math.ceil(maxReg * 0.25)) {
                badge.textContent = `🔥 ${remaining} / ${maxReg} seats left`;
                badge.className = 'seats-badge seats-low';
              } else {
                badge.textContent = `🎟️ ${count} / ${maxReg} registered`;
                badge.className = 'seats-badge seats-ok';
              }
            }
            // Disable reg button if full and student hasn't registered
            if (remaining <= 0 && !already) {
              reg.textContent = 'Full 🚫';
              reg.disabled = true;
            }
          });
        }
      } else {
        const lbl = document.createElement('span'); lbl.className = 'muted'; lbl.textContent = 'Event passed — registration closed'; actions.appendChild(lbl);
      }
    } else {
      // In eventsClone, just update the seats badge
      if (maxReg) {
        db.collection('registrations').where('eventId', '==', ev.id).get().then(snap => {
          const count = snap.size;
          const remaining = maxReg - count;
          const badge = document.getElementById(seatsBadgeId);
          if (badge) {
            if (remaining <= 0) {
              badge.textContent = '🚫 Full';
              badge.className = 'seats-badge seats-full';
            } else if (remaining <= Math.ceil(maxReg * 0.25)) {
              badge.textContent = `🔥 ${remaining} / ${maxReg} seats left`;
              badge.className = 'seats-badge seats-low';
            } else {
              badge.textContent = `🎟️ ${count} / ${maxReg} registered`;
              badge.className = 'seats-badge seats-ok';
            }
          }
        });
      }
    }

    if (isAdminLogged()) {
      const del = document.createElement('button'); del.className = 'btn outline'; del.textContent = 'Delete'; del.style.marginLeft = '8px';
      del.onclick = async () => {
        if (confirm('Delete this event?')) {
          await deleteEventFromDB(ev.id);
          renderEvents();
        }
      };
      actions.appendChild(del);

      const viewBtn = document.createElement('button'); viewBtn.className = 'btn outline'; viewBtn.textContent = 'View List'; viewBtn.style.marginLeft = '8px';
      viewBtn.onclick = () => { viewRegistrations(ev.id, ev.title); };
      actions.appendChild(viewBtn);
    }
    a.appendChild(actions);
    el.appendChild(a);
  });
}

async function populateEventsClone() {
  await renderEvents('eventsClone');
}

// admin login persistence (simple)
function isAdminLogged() { return localStorage.getItem('ce_admin_logged') === '1'; }
function setAdminLogged(v) { if (v) localStorage.setItem('ce_admin_logged', '1'); else localStorage.removeItem('ce_admin_logged'); }

// frontend signup — email only
async function signupStudent(email, pass) {
  try {
    const snapshot = await db.collection("students").where("email", "==", email).get();
    if (!snapshot.empty) return { ok: false, msg: 'Email already registered' };
    await db.collection("students").add({ email, pass });
    return { ok: true };
  } catch (e) { return { ok: false, msg: e.message }; }
}

// OTP Logic
let generatedOTP = null;
let otpEmail = null;
let resetOTP = null;
let resetEmail = null;
let googleVerifiedEmail = null;  // verified Gmail

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// ══════════════════════════════════════════════
//  GMAIL VERIFICATION
// ══════════════════════════════════════════════
document.getElementById('googleSignInBtn').addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const btn = document.getElementById('googleSignInBtn');
  const msg = document.getElementById('googleVerifyMsg');
  const emailInput = document.getElementById('su-gmail');
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

  const gmailRegex = /^[a-zA-Z0-9._%+\-]+@(gmail\.com|googlemail\.com)$/i;
  if (!email) {
    msg.textContent = '⚠️ Please enter your Gmail address.';
    msg.style.color = '#f87171';
    if (emailInput) emailInput.focus();
    return;
  }
  if (!gmailRegex.test(email)) {
    msg.textContent = '❌ Only @gmail.com addresses are accepted.';
    msg.style.color = '#f87171';
    if (emailInput) emailInput.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking...';
  msg.style.color = '';
  msg.textContent = 'Checking availability...';

  try {
    const snapshot = await db.collection("students").where("email", "==", email).get();
    if (!snapshot.empty) {
      msg.textContent = '⚠️ This Gmail is already registered. Switching to Sign In...';
      msg.style.color = '#f87171';
      btn.disabled = false;
      btn.textContent = 'Verify Gmail & Get OTP';
      setTimeout(() => {
        document.getElementById('authContainer').classList.remove('right-panel-active');
        document.getElementById('s-email').value = email;
      }, 1500);
      return;
    }
    googleVerifiedEmail = email;
    signupType = 'email';
    showVerifiedStep('Gmail Verified ✉️', email);
    btn.disabled = false;
    btn.textContent = 'Verify Gmail & Get OTP';
    msg.textContent = '';
    msg.style.color = '';
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
    msg.style.color = '#f87171';
    btn.disabled = false;
    btn.textContent = 'Verify Gmail & Get OTP';
  }
});

// Helper: transition to Step 2 (password setup)
function showVerifiedStep(label, identifier) {
  document.getElementById('verifiedBadgeLabel').textContent = label;
  document.getElementById('verifiedEmailDisplay').textContent = identifier;
  document.getElementById('googleVerifyStep').style.display = 'none';
  document.getElementById('passwordSetupStep').style.display = 'block';
}

// Back button — return from Step 2 to Step 1
document.getElementById('backToVerifyBtn').addEventListener('click', () => {
  // Hide step 2, show step 1
  document.getElementById('passwordSetupStep').style.display = 'none';
  document.getElementById('googleVerifyStep').style.display = 'block';

  // Reset step-2 fields (but keep gmail address in step-1 input)
  googleVerifiedEmail = null;
  generatedOTP = null;
  otpEmail = null;

  const suOtp = document.getElementById('su-otp');
  if (suOtp) { suOtp.value = ''; suOtp.style.display = 'none'; }
  const suPass = document.getElementById('su-pass');
  if (suPass) suPass.value = '';
  const getOtpBtn = document.getElementById('getOtpBtn');
  if (getOtpBtn) { getOtpBtn.style.display = 'inline-block'; getOtpBtn.textContent = 'Send OTP to Gmail'; getOtpBtn.disabled = false; }
  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) signupBtn.disabled = true;
  const signupMsg = document.getElementById('signupMsg');
  if (signupMsg) signupMsg.textContent = '';

  // Reset Google verify button state
  const gBtn = document.getElementById('googleSignInBtn');
  if (gBtn) { gBtn.disabled = false; gBtn.textContent = 'Verify Gmail & Get OTP'; }
  const gMsg = document.getElementById('googleVerifyMsg');
  if (gMsg) { gMsg.textContent = ''; gMsg.style.color = ''; }
});

// Stubs (no longer used but kept to avoid init() errors)
async function handleGoogleRedirectResult() { /* no-op */ }
async function applyGoogleVerifiedEmail(email) { /* no-op */ }


// OTP send for sign-up (triggered after Google verification)
document.getElementById('getOtpBtn').addEventListener('click', async () => {
  const email = googleVerifiedEmail;

  if (!email) {
    alert('Please verify your Google account first.');
    return;
  }

  otpEmail = email;
  generatedOTP = generateOTP();

  // Send via EmailJS
  const serviceID = "service_mk3003";
  const templateID = "template_wjinzjw";

  const templateParams = {
    to_email: email,
    otp: generatedOTP
  };

  // visual feedback
  const btn = document.getElementById('getOtpBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  emailjs.send(serviceID, templateID, templateParams)
    .then(() => {
      alert(`OTP sent to ${email}`);
      document.getElementById('su-otp').style.display = 'block';
      document.getElementById('getOtpBtn').style.display = 'none';
      document.getElementById('signupBtn').disabled = false;
      document.getElementById('signupMsg').textContent = 'OTP sent to your Google email.';
    }, (err) => {
      btn.textContent = originalText;
      btn.disabled = false;
      console.error('EmailJS Error:', err);
      // Fallback for demo
      alert(`DEMO MODE: OTP is ${generatedOTP}`);
      document.getElementById('su-otp').style.display = 'block';
      document.getElementById('getOtpBtn').style.display = 'none';
      document.getElementById('signupBtn').disabled = false;
    });
});


async function loginStudent(email, pass) {
  try {
    // First check if email exists
    const emailSnap = await db.collection("students").where("email", "==", email).get();
    if (emailSnap.empty) return { ok: false, code: 'not_found', msg: "Couldn't find your account" };
    // Email exists — check password
    const passSnap = await db.collection("students").where("email", "==", email).where("pass", "==", pass).get();
    if (!passSnap.empty) { setCurrentStudent({ email }); return { ok: true }; }
    return { ok: false, code: 'wrong_password', msg: 'Wrong password. Try again.' };
  } catch (e) { return { ok: false, code: 'error', msg: e.message }; }
}

// UI wiring — Sign Up
document.getElementById('signupBtn').addEventListener('click', async () => {
  const pass = document.getElementById('su-pass').value;
  const email = googleVerifiedEmail;

  if (!email) {
    document.getElementById('signupMsg').textContent = 'Please verify your Gmail first.';
    return;
  }
  if (!pass) { document.getElementById('signupMsg').textContent = 'Please set a password'; return; }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};'"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(pass)) {
    document.getElementById('signupMsg').textContent = 'Password needs 8+ chars, 1 uppercase, 1 number, 1 special char.';
    return;
  }

  // Verify the EmailJS OTP
  const otp = document.getElementById('su-otp').value.trim();
  if (otp !== generatedOTP || email !== otpEmail) {
    alert('Invalid OTP or session expired. Please request a new OTP.');
    return;
  }

  try {
    const r = await signupStudent(email, pass);
    if (r.ok) {
      document.getElementById('signupMsg').textContent = 'Account created! Logged in successfully.';
      setCurrentStudent({ email });
      resetSignupForm();
      renderEvents();
      updateStudentSection();
    } else {
      document.getElementById('signupMsg').textContent = r.msg || 'Error';
    }
  } catch (e) { showError('Signup error: ' + e.message); }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('s-email').value.trim();
  const pass = document.getElementById('s-pass').value;

  // Clear previous errors
  const emailInput = document.getElementById('s-email');
  const passInput = document.getElementById('s-pass');
  const emailErr = document.getElementById('emailFieldError');
  const passErr = document.getElementById('passFieldError');
  emailInput.classList.remove('input-error');
  passInput.classList.remove('input-error');
  emailErr.style.display = 'none';
  passErr.style.display = 'none';

  if (!email) {
    emailInput.classList.add('input-error');
    emailErr.innerHTML = '<span class="field-error-icon">⚠</span> Please enter your email.';
    emailErr.style.display = 'flex';
    emailInput.focus();
    return;
  }
  if (!pass) {
    passInput.classList.add('input-error');
    passErr.innerHTML = '<span class="field-error-icon">⚠</span> Please enter your password.';
    passErr.style.display = 'flex';
    passInput.focus();
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const r = await loginStudent(email, pass);
    if (r.ok) {
      renderEvents();
      updateStudentSection();
    } else {
      if (r.code === 'not_found') {
        emailInput.classList.add('input-error');
        emailErr.innerHTML = `<span class="field-error-icon">⊗</span> ${r.msg}`;
        emailErr.style.display = 'flex';
        emailInput.focus();
      } else {
        passInput.classList.add('input-error');
        passErr.innerHTML = `<span class="field-error-icon">⊗</span> ${r.msg}`;
        passErr.style.display = 'flex';
        passInput.focus();
      }
    }
  } catch (e) { showError('Login error: ' + e.message); }

  btn.disabled = false;
  btn.textContent = 'Sign In';
});


document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const e = document.getElementById('a-email').value.trim(); const p = document.getElementById('a-pass').value; // updated admin credentials
  // allow multiple admin accounts
  const admins = [
    { email: 'admin', pass: 'admin@123' },
    { email: 'kishor@18.com', pass: 'kishor18' },
    { email: 'mukesh@gmail.com', pass: 'mukesh3003' }
  ];
  const valid = admins.some(a => a.email === e && a.pass === p);
  if (valid) {
    setAdminLogged(true);
    document.getElementById('adminLoginCard').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('a-email').value = '';
    document.getElementById('a-pass').value = '';
    renderEvents();
    alert('Admin logged in');
  }
  else alert('Invalid admin credentials');
});
document.getElementById('adminLogoutBtn').addEventListener('click', () => { setAdminLogged(false); document.getElementById('adminLoginCard').style.display = 'block'; document.getElementById('adminPanel').style.display = 'none'; renderEvents(); });
// student logout handler
document.getElementById('studentLogoutBtn').addEventListener('click', () => {
  setCurrentStudent(null);
  renderEvents();
  updateStudentSection();
});

document.getElementById('addEventBtn').addEventListener('click', async () => {
  const title = document.getElementById('e-title').value.trim();
  const category = document.getElementById('e-category') ? document.getElementById('e-category').value : '';
  const date = document.getElementById('e-date').value;
  const venue = document.getElementById('e-venue').value.trim();
  const desc = document.getElementById('e-desc').value.trim();
  const url = document.getElementById('e-image-url').value.trim();
  const file = document.getElementById('e-image-file').files[0];
  const collegeName = document.getElementById('e-college-name').value.trim() || 'SCHOOL OF MINES';
  const collegeLogoFile = document.getElementById('e-college-logo').files[0];
  const maxRegToggle = document.getElementById('e-max-reg-toggle');
  const maxRegVal = (maxRegToggle && maxRegToggle.checked) ? document.getElementById('e-max-reg').value.trim() : '';
  const maxRegistrations = maxRegVal ? parseInt(maxRegVal) : null;

  let image = '';
  if (file) { image = await fileToDataURL(file); } else if (url) { image = url; }

  let collegeLogo = '';
  if (collegeLogoFile) { collegeLogo = await fileToDataURL(collegeLogoFile); }

  const eventData = {
    title, category, date, venue, desc, image,
    collegeName, collegeLogo,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (maxRegistrations) eventData.maxRegistrations = maxRegistrations;

  const success = await addEventToDB(eventData);
  if (success) {
    alert('Event added to Firebase!');
    // Reset college name back to default after submission
    document.getElementById('e-college-name').value = 'SCHOOL OF MINES';
    document.getElementById('e-college-logo').value = '';
    document.getElementById('collegeLogoPreview').style.display = 'none';
    // Reset max-reg toggle
    const tog = document.getElementById('e-max-reg-toggle');
    if (tog) { tog.checked = false; tog.dispatchEvent(new Event('change')); }
    renderEvents();
  }
});



// Forgot Password Logic
document.getElementById('sendResetOtpBtn').addEventListener('click', async () => {
  const email = document.getElementById('fp-email').value.trim();
  if (!email) { alert('Please enter email'); return; }

  // Check if email exists
  try {
    const snapshot = await db.collection("students").where("email", "==", email).get();
    if (snapshot.empty) { alert('Email not found. Please signup.'); return; }
  } catch (e) { console.error(e); }

  resetEmail = email;
  resetOTP = generateOTP();

  // Send via EmailJS (reusing same service/template)
  const serviceID = "service_mk3003";
  const templateID = "template_wjinzjw";

  const btn = document.getElementById('sendResetOtpBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  emailjs.send(serviceID, templateID, { to_email: email, otp: resetOTP })
    .then(() => {
      alert(`OTP sent to ${email}`);
      document.getElementById('fp-otp-section').style.display = 'block';
      document.getElementById('fp-bg-btn').style.display = 'none';
      document.getElementById('fp-email').disabled = true;
    }, (err) => {
      btn.textContent = originalText;
      btn.disabled = false;
      alert('Failed: ' + JSON.stringify(err));
    });
});

document.getElementById('resetPassBtn').addEventListener('click', async () => {
  const otp = document.getElementById('fp-otp').value.trim();
  const newPass = document.getElementById('fp-newpass').value;

  if (!otp || !newPass) { alert('Enter OTP and New Password'); return; }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(newPass)) {
    alert('Password must be at least 8 chars long, contain 1 uppercase, 1 number, and 1 special character.');
    return;
  }

  if (otp !== resetOTP) { alert('Invalid OTP'); return; }

  // Update password in Firebase
  try {
    const snapshot = await db.collection("students").where("email", "==", resetEmail).get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { pass: newPass });
      });
      await batch.commit();

      alert('Password updated successfully! Please login.');

      // cleanup
      document.getElementById('fp-email').value = '';
      document.getElementById('fp-otp').value = '';
      document.getElementById('fp-newpass').value = '';
      document.getElementById('fp-otp-section').style.display = 'none';
      document.getElementById('fp-bg-btn').style.display = 'block';
      document.getElementById('fp-email').disabled = false;
      resetOTP = null;
      resetEmail = null;
      showView('student');
    } else {
      alert('Error updating password. Email not found.');
    }
  } catch (e) {
    alert('Error updating password: ' + e.message);
  }
});

// ── Send Registration Confirmation Email via EmailJS ──
async function sendRegistrationConfirmEmail({ toEmail, studentName, regNo, sem, eventTitle, eventDate, eventVenue }) {
  const serviceID = 'service_mk3003';

  const semLabels = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '6': '6th' };
  const semLabel = semLabels[sem] || sem;

  // Format date nicely  e.g. "Friday, 6 March 2026"
  let dateStr = eventDate;
  try {
    const d = new Date(eventDate + 'T00:00:00');
    dateStr = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) { }

  // ── Try dedicated event-registration template first ──
  // If you have created 'template_event_reg' in EmailJS with variables:
  // {{to_email}}, {{student_name}}, {{reg_no}}, {{semester}}, {{event_title}}, {{event_date}}, {{event_venue}}
  // it will be used. Otherwise we fall back to the OTP template with a formatted message.
  const dedicatedParams = {
    to_email: toEmail,
    student_name: studentName,
    reg_no: regNo,
    semester: semLabel + ' Semester',
    event_title: eventTitle,
    event_date: dateStr,
    event_venue: eventVenue || '—'
  };

  try {
    await emailjs.send(serviceID, 'template_event_reg', dedicatedParams);
    console.log('Confirmation email sent to', toEmail);
    return true;
  } catch (err) {
    console.warn('template_event_reg not found or failed, falling back to OTP template:', err);
  }

  // ── Fallback: reuse the working OTP template (template_wjinzjw) ──
  // The OTP template uses {{to_email}} and {{otp}} — we repurpose {{otp}} as the message body.
  const message =
    `✅ You have been registered for the event!\n\n` +
    `👤 Name        : ${studentName}\n` +
    `🆔 Reg No      : ${regNo}\n` +
    `📚 Semester    : ${semLabel} Semester\n\n` +
    `🎉 Event       : ${eventTitle}\n` +
    `📅 Date        : ${dateStr}\n` +
    `📍 Venue       : ${eventVenue || '—'}\n\n` +
    `Thank you for registering!`;

  const fallbackParams = {
    to_email: toEmail,
    otp: message   // repurpose the {{otp}} placeholder for the confirmation message
  };

  try {
    await emailjs.send(serviceID, 'template_wjinzjw', fallbackParams);
    console.log('Confirmation email sent via fallback template to', toEmail);
    return true;
  } catch (err2) {
    console.error('Confirmation email failed on both templates:', err2);
    return false;
  }
}

// Registration Form Logic
document.getElementById('confirmRegBtn').addEventListener('click', async () => {
  if (!currentEventIdToRegister) return;
  const name = document.getElementById('r-name').value.trim();
  const regNo = document.getElementById('r-regno').value.trim();
  const college = document.getElementById('r-college').value.trim();
  const sem = document.getElementById('r-sem').value;
  const courseSelect = document.getElementById('r-course').value;
  const courseOther = document.getElementById('r-course-other').value.trim();
  const course = (courseSelect === 'others') ? courseOther : courseSelect;
  const projectName = document.getElementById('r-project-name').value.trim();
  const projectType = document.querySelector('input[name="projectType"]:checked').value;

  if (!name || !regNo || !college || !sem || !course || !projectName) { alert('Please fill in all details'); return; }
  if (courseSelect === 'others' && !courseOther) { alert('Please enter your course name'); return; }

  // Collect group members if group project
  let groupMembers = [];
  if (projectType === 'group') {
    const rows = document.querySelectorAll('#groupMembersList .group-member-row');
    let allFilled = true;
    rows.forEach(row => {
      const mName = row.querySelector('.member-name').value.trim();
      const mReg = row.querySelector('.member-regno').value.trim();
      if (mName && mReg) {
        groupMembers.push({ name: mName, regNo: mReg });
      } else if (mName || mReg) {
        allFilled = false; // partially filled
      }
    });
    if (!allFilled) { alert('Please fill in both Name and Register Number for all group members, or remove empty rows.'); return; }
    if (groupMembers.length === 0) { alert('Please add at least one group member or switch to Individual project.'); return; }
  }

  const btn = document.getElementById('confirmRegBtn');
  btn.disabled = true;
  btn.textContent = 'Registering…';

  const reqData = { name, regNo, college, sem, course, projectName, projectType, groupMembers };

  const student = getCurrentStudent();
  const success = await registerForEvent(student.email, currentEventIdToRegister, reqData);

  btn.disabled = false;
  btn.textContent = 'Confirm Registration';

  if (success) {
    // Send confirmation mail — await so we know if it succeeded
    btn.disabled = true;
    btn.textContent = 'Sending email…';
    const ev = currentEventToRegister || {};
    const emailSent = await sendRegistrationConfirmEmail({
      toEmail: student.email,
      studentName: name,
      regNo,
      sem,
      eventTitle: ev.title || document.getElementById('regEventTitle').textContent,
      eventDate: ev.date || '',
      eventVenue: ev.venue || ''
    });
    btn.disabled = false;
    btn.textContent = 'Confirm Registration';

    if (emailSent) {
      alert('✅ Successfully Registered!\nA confirmation email has been sent to ' + student.email);
    } else {
      alert('✅ Successfully Registered!\n⚠️ Confirmation email could not be sent. Please check your EmailJS setup.');
    }
    showView('home');
    renderEvents(); // Refresh buttons
  }
});

// Admin Registration View Logic
async function viewRegistrations(eventId, eventTitle) {
  currentAdminViewEventId = eventId;
  document.getElementById('ar-title').textContent = 'Registrations: ' + (eventTitle || 'Event');
  const tbody = document.getElementById('ar-tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  try {
    const snapshot = await db.collection("registrations").where("eventId", "==", eventId).get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      document.getElementById('ar-empty').style.display = 'block';
    } else {
      document.getElementById('ar-empty').style.display = 'none';

      let idx = 1;
      snapshot.forEach(doc => {
        const data = doc.data();
        const d = data.details || {};
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';

        // Format group members for display
        let membersHtml = '-';
        if (d.groupMembers && d.groupMembers.length > 0) {
          membersHtml = d.groupMembers.map((m, i) => `${i + 1}. ${m.name} (${m.regNo})`).join('<br>');
        }

        tr.innerHTML = `
                <td style="padding:10px;">${idx++}</td>
                <td style="padding:10px;">${d.name || '-'}</td>
                <td style="padding:10px;">${d.regNo || '-'}</td>
                <td style="padding:10px;">${d.sem || '-'}</td>
                <td style="padding:10px;">${data.email}</td>
                <td style="padding:10px;">${d.college || '-'}</td>
                <td style="padding:10px;">${d.course || '-'}</td>
                <td style="padding:10px;">${d.projectName || '-'}</td>
                <td style="padding:10px;"><span style="display:inline-block;padding:3px 10px;border-radius:8px;font-size:12px;font-weight:600;background:${d.projectType === 'group' ? 'rgba(99,102,241,0.18)' : 'rgba(16,185,129,0.18)'};color:${d.projectType === 'group' ? '#a5b4fc' : '#6ee7b7'};">${d.projectType === 'group' ? '👥 Group' : '👤 Individual'}</span></td>
                <td style="padding:10px;font-size:12px;">${membersHtml}</td>
            `;
        tbody.appendChild(tr);
      });
    }
    showView('adminRegistrations');
  } catch (e) {
    showError("Fetch error: " + e.message);
  }
}

async function exportRegistrations() {
  if (!currentAdminViewEventId) return;

  try {
    const snapshot = await db.collection("registrations").where("eventId", "==", currentAdminViewEventId).get();

    if (snapshot.empty) { alert('No data to export'); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "S.No,Name,Register No,Semester,Email,College,Course,Project Name,Project Type,Group Members\n";

    // Collect all rows into an array for sorting
    const rows = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const d = data.details || {};
      const membersStr = (d.groupMembers && d.groupMembers.length > 0)
        ? d.groupMembers.map((m, i) => `${m.name}(${m.regNo})`).join('; ')
        : '';
      rows.push({
        name: d.name || '',
        regNo: d.regNo || '',
        sem: d.sem || '',
        email: data.email || '',
        college: d.college || '-',
        course: d.course || '-',
        projectName: d.projectName || '-',
        projectType: d.projectType || '-',
        members: membersStr
      });
    });

    // Sort by Course first (A-Z), then by Register Number within each course
    rows.sort((a, b) => {
      const courseCompare = a.course.localeCompare(b.course, undefined, { sensitivity: 'base' });
      if (courseCompare !== 0) return courseCompare;
      return a.regNo.localeCompare(b.regNo, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Build CSV rows with fresh serial numbers
    rows.forEach((r, i) => {
      const row = `${i + 1},"${r.name}","${r.regNo}","${r.sem}","${r.email}","${r.college}","${r.course}","${r.projectName}","${r.projectType}","${r.members}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registrations_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error(e);
    alert("Export failed: " + e.message);
  }
}


function fileToDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

// --- ADDED FILTERS ---
function applyFilters(containerId) {
  let searchStr = '', filterDateStr = '';
  if (containerId === 'eventsList') {
    searchStr = (document.getElementById('search-events-home')?.value || '').toLowerCase();
    filterDateStr = document.getElementById('filter-date-home')?.value;
  } else {
    searchStr = (document.getElementById('search-events-all')?.value || '').toLowerCase();
    filterDateStr = document.getElementById('filter-date-all')?.value;
  }

  const el = document.getElementById(containerId);
  if (!el) return;
  const cards = el.querySelectorAll('.card');

  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const mutedTexts = card.querySelectorAll('.muted');
    let dateMatch = true;

    if (filterDateStr) {
       let cardDateStr = '';
       mutedTexts.forEach(m => {
          if (m.textContent.includes('📅')) cardDateStr = m.textContent.split('·')[0].replace('📅', '').trim();
       });
       if (cardDateStr !== filterDateStr) dateMatch = false; 
    }
    
    const searchMatch = title.includes(searchStr);
    if (searchMatch && dateMatch) card.style.display = 'block';
    else card.style.display = 'none';
  });
}

// --- ADDED FEEDBACK ---
async function submitFeedback() {
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const message = document.getElementById('f-message').value.trim();

  if (!name || !email || !message) { alert('Please fill in all fields.'); return; }
  
  const btn = document.getElementById('submitFeedbackBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await db.collection("feedback").add({
      name, email, message, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Thank you for your feedback! It makes this platform better.');
    document.getElementById('f-name').value = '';
    document.getElementById('f-email').value = '';
    document.getElementById('f-message').value = '';
  } catch(e) {
    alert('Error submitting feedback: ' + e.message);
  }
  btn.disabled = false;
  btn.textContent = 'Submit Feedback';
}

if(document.getElementById('submitFeedbackBtn')) {
  document.getElementById('submitFeedbackBtn').addEventListener('click', submitFeedback);
}

// --- ADDED DASHBOARD / CERTIFICATE ---
async function renderDashboard() {
  const currentStudent = getCurrentStudent();
  if (!currentStudent) return;
  
  document.getElementById('studentProfileInfo').textContent = `Profile: ${currentStudent.email}`;
  const myRegistrationsList = document.getElementById('myRegistrationsList');
  myRegistrationsList.innerHTML = '<p class="muted">Loading your registered events...</p>';
  
  try {
    const q = await db.collection("registrations").where("email", "==", currentStudent.email).get();
    let regEvents = q.docs.map(d => ({ regId: d.id, ...d.data() }));
    
    const allEvents = await loadEvents();
    myRegistrationsList.innerHTML = '';
    
    if (regEvents.length === 0) {
      myRegistrationsList.innerHTML = '<p class="muted">You have not registered for any events yet.</p>';
      return;
    }

    regEvents.forEach(regData => {
      const ev = allEvents.find(e => e.id === regData.eventId);
      if(!ev) return;
      
      const card = document.createElement('div');
      card.className = 'card';
      const evDate = new Date(ev.date + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const isPast = evDate.getTime() < today.getTime();
      
      let statusStr = isPast ? '<span style="color:var(--success)">Completed</span>' : '<span style="color:#f59e0b">Approved / Upcoming</span>';
      
      card.innerHTML = `<h3>${ev.title}</h3>
        <div class="muted">📅 ${ev.date} · 📍 ${ev.venue}</div>
        <p><strong>Status:</strong> ${statusStr}</p>
      `;

      if (isPast) {
         const certBtn = document.createElement('button');
         certBtn.className = 'btn outline';
         certBtn.textContent = '📃 Download Certificate';
         certBtn.onclick = () => generateCertificate(regData.details.name, ev.title, ev.date);
         card.appendChild(certBtn);
      }
      myRegistrationsList.appendChild(card);
    });
  } catch(e) {
     myRegistrationsList.innerHTML = `<p class="danger">Error: ${e.message}</p>`;
  }
}

function generateCertificate(name, eventTitle, eventDate) {
  try {
     const { jsPDF } = window.jspdf;
     const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
     
     // Background placeholder (could use an image)
     doc.setFillColor(245, 245, 255);
     doc.rect(0, 0, 297, 210, 'F');
     
     // Border
     doc.setDrawColor(79, 70, 229);
     doc.setLineWidth(5);
     doc.rect(10, 10, 277, 190);
     
     doc.setTextColor(30, 27, 75);
     doc.setFontSize(38);
     doc.setFont("helvetica", "bold");
     doc.text("Certificate of Participation", 148, 55, { align: "center" });
     
     doc.setFontSize(20);
     doc.setFont("helvetica", "normal");
     doc.text("This is to certify that", 148, 85, { align: "center" });
     
     doc.setFontSize(30);
     doc.setFont("helvetica", "bold");
     doc.setTextColor(79, 70, 229);
     doc.text(name || "Student Name", 148, 105, { align: "center" });
     
     doc.setFontSize(20);
     doc.setFont("helvetica", "normal");
     doc.setTextColor(30, 27, 75);
     doc.text("has successfully participated in", 148, 125, { align: "center" });
     
     doc.setFontSize(26);
     doc.setFont("helvetica", "bold");
     doc.text(eventTitle || "Event Name", 148, 145, { align: "center" });
     
     doc.setFontSize(16);
     doc.setFont("helvetica", "normal");
     doc.text(`held on ${eventDate || 'Date'}`, 148, 160, { align: "center" });
     
     doc.setDrawColor(0, 0, 0);
     doc.setLineWidth(0.5);
     doc.line(50, 180, 100, 180);
     doc.text("Event Coordinator", 75, 190, { align: "center" });
     
     doc.line(197, 180, 247, 180);
     doc.text("Principal", 222, 190, { align: "center" });

     doc.save(`${name.replace(/ /g,"_")}_Certificate.pdf`);
  } catch(e) {
     alert("Error generating certificate. Ensure jsPDF is loaded.");
     console.error(e);
  }
}

// --- ADDED ADMIN ANALYTICS & FEEDBACK ---
let adminChart = null;
async function renderAdminAnalytics() {
  try {
    const snap = await db.collection("registrations").get();
    const eventCounts = {};
    if(snap.empty) { console.log('No regs for chart'); return; }
    
    snap.forEach(doc => {
      const data = doc.data();
      eventCounts[data.eventId] = (eventCounts[data.eventId] || 0) + 1;
    });

    const events = await loadEvents();
    const eventLabels = Object.keys(eventCounts).map(eid => {
       const ev = events.find(e => e.id === eid);
       return ev ? (ev.title.length > 20 ? ev.title.substring(0,20)+'...' : ev.title) : 'Deleted Event';
    });
    const eventData = Object.values(eventCounts);

    const ctx = document.getElementById('registrationsChart');
    if (!ctx) return;
    if (adminChart) adminChart.destroy();
    
    adminChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: eventLabels,
        datasets: [{
          label: 'Registrations per Event',
          data: eventData,
          backgroundColor: 'rgba(79, 70, 229, 0.7)',
          borderColor: 'rgba(79, 70, 229, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: document.body.classList.contains('light-theme') ? '#000' : '#fff' }}
        },
        scales: {
          y: { 
             beginAtZero: true, 
             ticks: { stepSize: 1, color: document.body.classList.contains('light-theme') ? '#000' : '#fff' },
             grid: { color: 'rgba(128,128,128,0.2)' }
          },
          x: {
             ticks: { color: document.body.classList.contains('light-theme') ? '#000' : '#fff' },
             grid: { color: 'rgba(128,128,128,0.2)' }
          }
        }
      }
    });
  } catch(e) {
    console.error("Analytics error", e);
  }
}

async function loadFeedbacks() {
  const adminFeedbackList = document.getElementById('adminFeedbackList');
  if (!adminFeedbackList) return;
  adminFeedbackList.innerHTML = '<p class="muted">Loading feedback...</p>';
  try {
    const snap = await db.collection("feedback").orderBy("timestamp", "desc").get();
    if(snap.empty) { adminFeedbackList.innerHTML = '<p class="muted">No feedback yet.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
      const data = doc.data();
      const time = data.timestamp ? data.timestamp.toDate().toLocaleString() : '';
      html += `<div style="background:var(--card-bg); padding:10px; border-radius:8px; border:1px solid var(--card-border);">
        <strong>${data.name}</strong> (<a href="mailto:${data.email}">${data.email}</a>)
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:5px;">${time}</div>
        <p>${data.message}</p>
      </div>`;
    });
    adminFeedbackList.innerHTML = html;
  } catch(e) {
    adminFeedbackList.innerHTML = '<p class="danger">Error loading feedback: ' + e.message + '</p>';
  }
}

async function renderGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  if(!galleryGrid) return;
  galleryGrid.innerHTML = '<p class="muted" style="grid-column: 1/-1;">Loading gallery...</p>';
  try {
     const allEvents = await loadEvents();
     const withImages = allEvents.filter(e => e.image && e.image.length > 5);
     
     if (withImages.length === 0) {
        galleryGrid.innerHTML = '<p class="muted" style="grid-column: 1/-1;">No event photos available yet.</p>';
        return;
     }

     galleryGrid.innerHTML = '';
     withImages.forEach(ev => {
         const div = document.createElement('div');
         div.style.cssText = 'background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:10px; text-align:center; transition: transform 0.3s; cursor:pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);';
         div.onmouseover = () => div.style.transform = 'scale(1.03)';
         div.onmouseout = () => div.style.transform = 'scale(1)';
         div.innerHTML = `<img src="${ev.image}" alt="${ev.title}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:10px;" />
                          <div style="font-weight:bold;">${ev.title}</div>
                          <div class="muted" style="font-size:12px;">${ev.date}</div>`;
         galleryGrid.appendChild(div);
     });
  } catch(e) {
     galleryGrid.innerHTML = '<p class="danger" style="grid-column: 1/-1;">Error loading gallery</p>';
  }
}

window.toggleAdminTab = function(tab) {
  document.getElementById('adminTabEvents').style.display = 'none';
  document.getElementById('adminTabAnalytics').style.display = 'none';
  document.getElementById('adminTabFeedback').style.display = 'none';

  if (tab === 'events') {
    document.getElementById('adminTabEvents').style.display = 'block';
  } else if (tab === 'analytics') {
    document.getElementById('adminTabAnalytics').style.display = 'block';
    renderAdminAnalytics();
  } else if (tab === 'feedback') {
    document.getElementById('adminTabFeedback').style.display = 'block';
    loadFeedbacks();
  }
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById(id).style.display = 'block';

  if (id === 'home') {
    const searchEl = document.getElementById('search-events-home');
    const dateEl = document.getElementById('filter-date-home');
    if (searchEl) searchEl.value = '';
    if (dateEl) dateEl.value = '';
    renderEvents('eventsList');
  }
  if (id === 'events') {
    const searchEl = document.getElementById('search-events-all');
    const dateEl = document.getElementById('filter-date-all');
    if (searchEl) searchEl.value = '';
    if (dateEl) dateEl.value = '';
    renderEvents('eventsClone');
  }
  if (id === 'gallery') renderGallery();
  if (id === 'student') updateStudentSection();
  if (id === 'dashboard') renderDashboard();

  if (id === 'admin') {
    if (isAdminLogged()) {
      document.getElementById('adminLoginCard').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
    } else {
      document.getElementById('adminLoginCard').style.display = 'block';
      document.getElementById('adminPanel').style.display = 'none';
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// init
(function () {
  try {
    // Only call showView to trigger rendering, avoiding double-calls
    updateStudentSection();
    showView('home');
    // Note: No redirect result handling needed — using Gmail domain verification instead
  } catch (e) {
    showError('Init error: ' + e.message);
  }
})();

// --- MASCOT & PASSWORD TOGGLE LOGIC ---
function togglePassword(inputId, mascotId) {
  const input = document.getElementById(inputId);
  const mascot = document.getElementById(mascotId);
  if (input.type === "password") {
    input.type = "text";
    if (mascot) mascot.textContent = "🫣"; // Peeking/Fake Hiding
  } else {
    input.type = "password";
    // Check focus
    if (document.activeElement === input) {
      if (mascot) mascot.textContent = "🐵"; // Not hiding
    }
  }
}

function setupMascot(inputId, mascotId) {
  const input = document.getElementById(inputId);
  const mascot = document.getElementById(mascotId);
  if (!input || !mascot) return;

  input.addEventListener('focus', () => {
    if (input.type === "password") {
      mascot.textContent = "🐵"; // Don't hide
    } else {
      mascot.textContent = "🫣"; // Fake hide
    }
  });

  input.addEventListener('blur', () => {
    mascot.textContent = "🐵";
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupMascot('s-pass', 'mascot-signin');
  setupMascot('su-pass', 'mascot-signup');

  // ── Max Registrations toggle ──
  const maxRegToggle = document.getElementById('e-max-reg-toggle');
  const maxRegInputWrap = document.getElementById('max-reg-input-wrap');
  if (maxRegToggle && maxRegInputWrap) {
    maxRegToggle.addEventListener('change', () => {
      if (maxRegToggle.checked) {
        maxRegInputWrap.style.display = 'block';
        document.getElementById('e-max-reg').focus();
      } else {
        maxRegInputWrap.style.display = 'none';
        document.getElementById('e-max-reg').value = '';
      }
    });
  }

  // College name reset button
  const resetCollegeNameBtn = document.getElementById('resetCollegeNameBtn');
  if (resetCollegeNameBtn) {
    resetCollegeNameBtn.addEventListener('click', () => {
      document.getElementById('e-college-name').value = 'SCHOOL OF MINES';
    });
  }

  // College logo live preview
  const collegeLogoInput = document.getElementById('e-college-logo');
  const logoPreview = document.getElementById('collegeLogoPreview');
  const logoPreviewImg = document.getElementById('collegeLogoPreviewImg');
  const clearLogoBtn = document.getElementById('clearCollegeLogoBtn');

  if (collegeLogoInput) {
    collegeLogoInput.addEventListener('change', () => {
      const file = collegeLogoInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          logoPreviewImg.src = e.target.result;
          logoPreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      } else {
        logoPreview.style.display = 'none';
      }
    });
  }

  if (clearLogoBtn) {
    clearLogoBtn.addEventListener('click', () => {
      collegeLogoInput.value = '';
      logoPreviewImg.src = '';
      logoPreview.style.display = 'none';
    });
  }

  // ── Course "Others" Toggle ──
  const courseSelect = document.getElementById('r-course');
  const courseOtherInput = document.getElementById('r-course-other');
  if (courseSelect && courseOtherInput) {
    courseSelect.addEventListener('change', () => {
      if (courseSelect.value === 'others') {
        courseOtherInput.style.display = 'block';
        courseOtherInput.focus();
      } else {
        courseOtherInput.style.display = 'none';
        courseOtherInput.value = '';
      }
    });
  }

  // ── Project Type Toggle (Individual / Group) ──
  const typeIndividual = document.getElementById('r-type-individual');
  const typeGroup = document.getElementById('r-type-group');
  const groupSection = document.getElementById('groupMembersSection');

  function handleProjectTypeChange() {
    if (typeGroup && typeGroup.checked) {
      groupSection.style.display = 'block';
    } else {
      groupSection.style.display = 'none';
    }
  }

  if (typeIndividual) typeIndividual.addEventListener('change', handleProjectTypeChange);
  if (typeGroup) typeGroup.addEventListener('change', handleProjectTypeChange);

  // ── Add Group Member Button ──
  const addMemberBtn = document.getElementById('addMemberBtn');
  if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
      const list = document.getElementById('groupMembersList');
      const count = list.querySelectorAll('.group-member-row').length;
      const memberNum = count + 2; // +2 because registering student is Member 1

      const row = document.createElement('div');
      row.className = 'group-member-row';
      row.innerHTML = `
        <input placeholder="Member ${memberNum} — Full Name" class="member-name" />
        <input placeholder="Register Number" class="member-regno" />
        <button type="button" class="remove-member-btn" title="Remove member">✕</button>
      `;

      // Remove button handler
      row.querySelector('.remove-member-btn').addEventListener('click', () => {
        row.remove();
        // Re-number placeholders
        const rows = list.querySelectorAll('.group-member-row');
        rows.forEach((r, i) => {
          r.querySelector('.member-name').placeholder = `Member ${i + 2} — Full Name`;
        });
      });

      list.appendChild(row);
    });
  }
});