// js/dashboard.js (Final, Complete Version with Dark Mode Toggle & Smart Client Search)

document.addEventListener('DOMContentLoaded', async () => {
    // --- NEW: THEME/DARK MODE LOGIC ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Function to apply the theme based on the provided string ('light' or 'dark')
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
    };

    // On page load, check for a saved theme in localStorage and apply it
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Optional: Check user's OS preference if no theme is saved
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            applyTheme('dark');
        }
    }

    // Add click event listener to the toggle button if it exists
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (body.classList.contains('dark-mode')) {
                // Switch to light mode
                body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            } else {
                // Switch to dark mode
                body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // --- END OF THEME/DARK MODE LOGIC ---


    // --- AUTHENTICATION CHECK ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    // --- DOM ELEMENT REFERENCES ---
    const calendarEl = document.getElementById('calendar');
    const appointmentModal = document.getElementById('appointment-modal');
    const appointmentForm = document.getElementById('appointment-form');
    const clientSearchInput = document.getElementById('client-name-search');
    const clientSearchResults = document.getElementById('client-search-results');
    const clientIdInput = document.getElementById('client-id');
    const clientEmailInput = document.getElementById('client-email');
    const availabilityModal = document.getElementById('availability-modal');
    const availabilityForm = document.getElementById('availability-form');
    const availabilityClientSearchInput = document.getElementById('availability-client-search');
    const availabilitySearchResults = document.getElementById('availability-search-results');
    const availabilityClientEmailInput = document.getElementById('availability-client-email');
    const timeSlotGridContainer = document.getElementById('time-slot-grid-container');
    const weekDisplay = document.getElementById('week-display');
    const clientInfoBtn = document.getElementById('client-info-btn');
    const clientStatsModal = document.getElementById('client-stats-modal');
    const statsClientName = document.getElementById('stats-client-name');
    const statsCompleted = document.getElementById('stats-completed');
    const statsScheduled = document.getElementById('stats-scheduled');
    const statsLastVisit = document.getElementById('stats-last-visit');
    const statsAllNotes = document.getElementById('stats-all-notes');
    
    const style = document.createElement('style');
    style.innerHTML = `
    .note-date { display: block; margin-top: 6px; font-size: 0.8em; color: var(--text-light); font-style: normal; font-weight: 500; }
    #stats-all-notes li { display: flex; flex-direction: column; align-items: flex-start; }
    `;
    document.head.appendChild(style);

    let isNewClientForThisAppointment = false;
    document.getElementById('user-info').textContent = `Welcome, Manager`;
    
    // --- NEW: MODAL CLOSE ON BACKDROP CLICK ---
    // Helper function to close a modal when its backdrop (the dialog element itself) is clicked.
    const closeModalOnClickOutside = (modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.close();
            }
        });
    };
    
    closeModalOnClickOutside(appointmentModal);
    closeModalOnClickOutside(availabilityModal);
    closeModalOnClickOutside(clientStatsModal);
    // --- END OF MODAL CLOSE LOGIC ---

    function formatDateWithOrdinal(dateString) {
        const date = new Date(dateString);
        const day = date.getDate();
        const year = date.getFullYear();
        const month = date.toLocaleString('en-US', { month: 'long' });
        let suffix = 'th';
        if (day % 10 === 1 && day !== 11) suffix = 'st';
        if (day % 10 === 2 && day !== 12) suffix = 'nd';
        if (day % 10 === 3 && day !== 13) suffix = 'rd';
        return `${month} ${day}${suffix}, ${year}`;
    }

    const CLIENT_COLORS = [
        '#2ecc71', '#3498db', '#9b59b6', '#f1c40f',
        '#e74c3c', '#1abc9c', '#e67e22', '#34495e',
        '#d35400', '#2980b9', '#27ae60', '#c0392b'
    ];

    const getHashIndex = (id) => {
        const s = String(id);
        let hash = 0;
        if (s.length === 0) return 0;
        for (let i = 0; i < s.length; i++) {
            hash = (hash << 5) - hash + s.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const getColorByClientId = (clientId) => {
        if (!clientId) return '#a0aec0';
        const index = getHashIndex(clientId);
        return CLIENT_COLORS[index % CLIENT_COLORS.length];
    };

    const toDateTimeLocal = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const openAppointmentModal = async (data = {}) => {
        isNewClientForThisAppointment = false;
        appointmentForm.reset();
        clientSearchResults.style.display = 'none';
        clientSearchResults.innerHTML = '';
        const clientId = data.extendedProps?.client_id;
        clientInfoBtn.style.display = clientId ? 'flex' : 'none';
        const isNew = !data.id;
        document.getElementById('appointment-id').value = data.id || '';
        document.getElementById('modal-title').textContent = isNew ? 'New Appointment' : 'Edit Appointment';
        document.getElementById('service-type').value = data.extendedProps?.service_type || 'Haircut';
        clientIdInput.value = clientId || '';
        if (clientId) {
            const { data: client } = await supabase.from('clients').select('name, email').eq('id', clientId).single();
            if (client) {
                clientSearchInput.value = client.name;
                clientEmailInput.value = client.email || '';
            }
        }
        document.getElementById('start-time').value = toDateTimeLocal(data.start || new Date());
        document.getElementById('end-time').value = toDateTimeLocal(data.end || new Date(new Date().getTime() + 60 * 60 * 1000));
        document.getElementById('notes').value = data.extendedProps?.notes || '';
        updateAppointmentModalUI(data.id, data.extendedProps?.status);
        appointmentModal.showModal();
    };

    const updateAppointmentModalUI = (appointmentId, status) => {
        const clientGroup = document.getElementById('client-details-group');
        const actionsContainer = document.getElementById('modal-actions');
        actionsContainer.innerHTML = '';
        const isBlocked = document.getElementById('service-type').value === 'Blocked';
        clientGroup.style.display = isBlocked ? 'none' : 'block';
        if (appointmentId) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-login-simple button-danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.marginRight = 'auto';
            deleteBtn.onclick = handleDeleteAppointment;
            actionsContainer.appendChild(deleteBtn);
        }
        const saveBtn = document.createElement('button'); saveBtn.type = 'submit'; saveBtn.className = 'btn-submit'; saveBtn.textContent = 'Save';
        const closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'btn-login-simple'; closeBtn.textContent = 'Cancel'; closeBtn.onclick = () => appointmentModal.close();
        actionsContainer.append(saveBtn, closeBtn);
        if (status === 'confirmed') {
            const emailBtn = document.createElement('button'); emailBtn.type = 'button'; emailBtn.className = 'btn-submit'; emailBtn.textContent = 'Email'; emailBtn.onclick = sendConfirmationEmail;
            const icsBtn = document.createElement('button'); icsBtn.type = 'button'; icsBtn.className = 'btn-submit'; icsBtn.textContent = 'Calendar Invite'; icsBtn.onclick = downloadIcsFile;
            actionsContainer.insertBefore(icsBtn, saveBtn);
            actionsContainer.insertBefore(emailBtn, saveBtn);
        }
    };

    document.getElementById('service-type').addEventListener('change', () => {
        const appointmentId = document.getElementById('appointment-id').value;
        updateAppointmentModalUI(appointmentId, appointmentId ? 'editing' : null);
    });

    appointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('appointment-id').value;
        const isBlocked = document.getElementById('service-type').value === 'Blocked';
        const startTimeISO = new Date(document.getElementById('start-time').value).toISOString();
        const endTimeISO = new Date(document.getElementById('end-time').value).toISOString();
        let notes = document.getElementById('notes').value;
        if (isNewClientForThisAppointment) {
            const autoNote = "First Time Client";
            notes = notes ? `${autoNote}. ${notes}` : autoNote;
        }
        const data = {
            stylist_id: session.user.id,
            start_time: startTimeISO,
            end_time: endTimeISO,
            service_type: document.getElementById('service-type').value,
            notes: notes,
            status: isBlocked ? 'blocked' : (clientIdInput.value ? 'confirmed' : 'available'),
            client_id: isBlocked ? null : (clientIdInput.value || null),
        };
        const { error } = id ? await supabase.from('appointments').update(data).eq('id', id) : await supabase.from('appointments').insert(data);
        if (error) {
            alert('Error: ' + error.message);
        } else {
            appointmentModal.close();
            calendar.refetchEvents();
        }
    });

    // --- MODIFIED: CLIENT NAME INPUT FIX ---
    // This function is updated to allow spaces in the client name input field.
    function setupClientSearch(searchInput, resultsContainer, onSelectCallback) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            clientInfoBtn.style.display = 'none';
            const rawValue = searchInput.value;
            
            // FIX: Instead of calling a heavy-handed callback that overwrites the input,
            // we explicitly clear the hidden client ID. This prevents the input value
            // from being reset on every keystroke, thus allowing spaces.
            if (searchInput === clientSearchInput) {
                clientIdInput.value = '';
            }
            isNewClientForThisAppointment = true; // Assume new client until one is selected from the list

            const searchTerm = rawValue.trim();
            if (searchTerm.length < 1) {
                resultsContainer.innerHTML = '';
                resultsContainer.style.display = 'none';
                return;
            }
            searchTimeout = setTimeout(() => handleClientSearch(searchTerm, resultsContainer), 250);
        });

        resultsContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('.search-result');
            if (!target) return;

            if (target.classList.contains('add-new')) {
                const newName = target.dataset.name;
                const newEmail = prompt(`Enter email for new client "${newName}": (optional)`);
                if (newEmail === null) return;
                const { data: newClient, error } = await supabase.from('clients').insert({ name: newName, email: newEmail || null, stylist_id: session.user.id }).select().single();
                if (error) { alert('Failed to add client: ' + error.message); return; }
                isNewClientForThisAppointment = true;
                if (onSelectCallback) onSelectCallback(newClient);
            } else {
                isNewClientForThisAppointment = false;
                clientInfoBtn.style.display = 'flex';
                if (onSelectCallback) onSelectCallback({ id: target.dataset.id, name: target.dataset.name, email: target.dataset.email });
            }
            // The onSelectCallback now handles updating the input field value.
            // We no longer set it directly here.
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
        });
    }

    async function handleClientSearch(searchTerm, resultsContainer) {
        // Note: searchTerm is already trimmed before being passed here.
        const { data: clients, error } = await supabase.from('clients').select('id, name, email').ilike('name', `%${searchTerm}%`).limit(5);
        if (error) return;
        resultsContainer.innerHTML = '';
        clients.forEach(client => {
            const resultEl = document.createElement('div');
            resultEl.className = 'search-result';
            resultEl.innerHTML = `<strong>${client.name}</strong><small>${client.email || 'No email'}</small>`;
            resultEl.dataset.id = client.id;
            resultEl.dataset.name = client.name;
            resultEl.dataset.email = client.email || '';
            resultsContainer.appendChild(resultEl);
        });
        const addNewEl = document.createElement('div');
        addNewEl.className = 'search-result add-new';
        addNewEl.innerHTML = `+ Add new client: <strong>"${searchTerm}"</strong>`;
        addNewEl.dataset.name = searchTerm;
        resultsContainer.appendChild(addNewEl);
        resultsContainer.style.display = 'block';
    }
    // --- END OF CLIENT NAME INPUT FIX ---

    setupClientSearch(clientSearchInput, clientSearchResults, (client) => {
        clientIdInput.value = client.id;
        clientEmailInput.value = client.email || '';
        clientSearchInput.value = client.name;
    });
    setupClientSearch(availabilityClientSearchInput, availabilitySearchResults, (client) => {
        availabilityClientEmailInput.value = client.email || '';
        availabilityClientSearchInput.value = client.name;
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.client-search-wrapper')) {
            clientSearchResults.style.display = 'none';
            availabilitySearchResults.style.display = 'none';
        }
    });

    clientInfoBtn.addEventListener('click', async () => {
        const clientId = clientIdInput.value;
        if (!clientId) return;
        statsClientName.textContent = `History for ${clientSearchInput.value}`;
        statsCompleted.textContent = '...';
        statsScheduled.textContent = '...';
        statsLastVisit.textContent = '...';
        statsAllNotes.innerHTML = '<li>Loading...</li>';
        clientStatsModal.showModal();
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('start_time, notes')
            .eq('client_id', clientId)
            .order('start_time', { ascending: false });
        if (error || !appointments) {
            statsAllNotes.innerHTML = '<li>Error fetching data.</li>';
            return;
        }
        if (appointments.length === 0) {
            statsCompleted.textContent = '0';
            statsScheduled.textContent = '0';
            statsLastVisit.textContent = 'N/A';
            statsAllNotes.innerHTML = '<li>No appointments found.</li>';
            return;
        }
        const now = new Date();
        let completedCount = 0;
        let scheduledCount = 0;
        const allNotesWithDates = [];
        appointments.forEach(apt => {
            if (new Date(apt.start_time) < now) {
                completedCount++;
            } else {
                scheduledCount++;
            }
            if (apt.notes) {
                allNotesWithDates.push({ text: apt.notes, date: apt.start_time });
            }
        });
        statsCompleted.textContent = completedCount;
        statsScheduled.textContent = scheduledCount;
        statsLastVisit.textContent = formatDateWithOrdinal(appointments[0].start_time);
        statsAllNotes.innerHTML = '';
        if (allNotesWithDates.length > 0) {
            allNotesWithDates.forEach(noteItem => {
                const li = document.createElement('li');
                const noteText = document.createElement('span');
                const noteDate = document.createElement('span');
                noteText.textContent = noteItem.text;
                noteDate.textContent = formatDateWithOrdinal(noteItem.date);
                noteDate.className = 'note-date';
                li.appendChild(noteText);
                li.appendChild(noteDate);
                statsAllNotes.appendChild(li);
            });
        } else {
            statsAllNotes.innerHTML = '<li>No notes recorded for this client.</li>';
        }
    });

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        editable: true, 
        selectable: true,

        // =========================================================
        // ==         MOBILE-FRIENDLY & ROBUSTNESS FIX            ==
        // =========================================================
        // By using BOTH dateClick and select, we ensure the calendar is
        // responsive to any user action on any device.
        
        // This handler is for a simple "tap" or "click" on a single time.
        // It's the most reliable way to capture quick taps on mobile.
        dateClick: function(info) {
            const today = new Date(); 
            today.setHours(0, 0, 0, 0);
            if (info.date < today) { return; } // Prevent creating in past

            // Create a default 1-hour appointment from the click time
            const endTime = new Date(info.date.getTime() + 60 * 60 * 1000);

            openAppointmentModal({ start: info.date, end: endTime });
        },

        // This handler is for when a user "drags" to select a time range.
        // It will still work on desktop and for press-and-drag on mobile.
        select: (info) => {
            const today = new Date(); 
            today.setHours(0, 0, 0, 0);
            if (info.start < today) { calendar.unselect(); return false; }

            const modalData = { start: info.start, end: info.end };
            if (info.allDay) {
                modalData.start.setHours(9, 0, 0, 0);
                modalData.end = new Date(modalData.start);
                modalData.end.setHours(10, 0, 0, 0);
            }
            openAppointmentModal(modalData);
        },
        // =========================================================
        // ==                  END OF FIX                         ==
        // =========================================================

        eventClick: (info) => openAppointmentModal(info.event),
        eventDrop: handleEventUpdate, 
        eventResize: handleEventUpdate,
        slotMinTime: '08:00:00',
        slotMaxTime: '18:00:00',
        businessHours: { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '18:00' },
        height: 'auto',
        events: async (f, s) => {
            const { data } = await supabase.from('appointments').select('*, client:clients(name)');
            s(data.map(apt => ({
                id: apt.id,
                title: apt.status === 'confirmed' ? `${apt.service_type}: ${apt.client?.name || 'Walk-in'}` : apt.service_type,
                start: apt.start_time,
                end: apt.end_time,
                color: getColorByClientId(apt.client_id),
                borderColor: getColorByClientId(apt.client_id),
                classNames: [`status-${apt.status}`, `service-${apt.service_type.toLowerCase()}`],
                extendedProps: { ...apt }
            })));
        },
        eventContent: (arg) => {
            const props = arg.event.extendedProps;
            const title = arg.event.title;
            let html = `<div class="fc-event-main-content"><b>${title}</b></div>`;
            if (arg.view.type === 'timeGridDay' && props.notes) {
                html += `<div class="fc-event-notes"><i>Note: ${props.notes}</i></div>`;
            }
            return { html: html };
        }
    });
    calendar.render();

    // The rest of your file is unchanged...
    const channel = supabase.channel('public:appointments').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        setTimeout(() => calendar.refetchEvents(), 100);
    }).subscribe();

    async function handleEventUpdate(info) {
        const { error } = await supabase.from('appointments').update({ start_time: info.event.startStr, end_time: info.event.endStr }).eq('id', info.event.id);
        if (error) { alert('Error updating: ' + error.message); info.revert(); }
    }

    async function handleDeleteAppointment() {
        const appointmentId = document.getElementById('appointment-id').value;
        if (!appointmentId) return;
        const isConfirmed = window.confirm('Are you sure you want to delete this appointment? This action cannot be undone.');
        if (isConfirmed) {
            const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
            if (error) {
                alert('Error deleting appointment: ' + error.message);
            } else {
                appointmentModal.close();
                calendar.refetchEvents();
            }
        }
    }

    async function sendConfirmationEmail() {
        const recipient_email = document.getElementById('client-email').value;
        if (!recipient_email) return alert('Please select a client with an email.');
        const subject = `Appointment Confirmation: ${document.getElementById('service-type').value}`;
        const html_body = `<h1>Your Appointment is Confirmed!</h1><p>Hi ${clientSearchInput.value || 'there'},</p><p>This is a confirmation for your appointment on <strong>${new Date(document.getElementById('start-time').value).toLocaleString()}</strong>.</p>`;
        const { error } = await supabase.functions.invoke('email-sender', { body: { recipient_email, subject, html_body } });
        if (error) alert('Failed to send email: ' + error.message); else alert('Confirmation email sent!');
    }

    function downloadIcsFile() {
        if (!clientIdInput.value) return alert('Please select a client first.');
        ics().addEvent(`Appointment: ${document.getElementById('service-type').value}`, `Details for your appointment.`, 'Salon Location', document.getElementById('start-time').value, document.getElementById('end-time').value).download();
    }

    document.getElementById('request-availability-btn').addEventListener('click', () => {
        availabilityForm.reset();
        currentWeekOffset = 0;
        generateAvailabilityGrid();
        availabilityModal.showModal();
    });

    let currentWeekOffset = 0; // Moved this to a wider scope
    document.getElementById('prev-week').addEventListener('click', () => { currentWeekOffset--; generateAvailabilityGrid(); });
    document.getElementById('next-week').addEventListener('click', () => { currentWeekOffset++; generateAvailabilityGrid(); });

    async function generateAvailabilityGrid() {
        timeSlotGridContainer.innerHTML = '<div>Loading...</div>';
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7)));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        weekDisplay.textContent = `${startOfWeek.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${endOfWeek.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
        document.getElementById('prev-week').disabled = currentWeekOffset <= 0;
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('start_time, end_time')
            .gte('start_time', startOfWeek.toISOString())
            .lte('end_time', endOfWeek.toISOString());
        if (error) {
            timeSlotGridContainer.innerHTML = '<div>Error loading schedule.</div>';
            console.error('Error fetching appointments for availability:', error);
            return;
        }
        const bookedSlots = new Set();
        if (appointments) {
            appointments.forEach(apt => {
                const start = new Date(apt.start_time).getTime();
                const end = new Date(apt.end_time).getTime();
                for (let t = start; t < end; t += 60 * 60 * 1000) {
                    const slotDate = new Date(t);
                    slotDate.setMinutes(0, 0, 0);
                    bookedSlots.add(slotDate.toISOString());
                }
            });
        }
        timeSlotGridContainer.innerHTML = '';
        for (let d = 0; d < 7; d++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + d);
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `${currentDay.toLocaleDateString('en-US', { weekday: 'short' })} <br> <span class="day-number">${currentDay.getDate()}</span>`;
            dayColumn.appendChild(dayHeader);
            for (let h = 9; h < 18; h++) {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                const slotTime = new Date(currentDay);
                slotTime.setHours(h, 0, 0, 0);
                if (slotTime < new Date() || bookedSlots.has(slotTime.toISOString())) {
                    slot.classList.add('disabled');
                } else {
                    slot.dataset.time = slotTime.toISOString();
                    slot.onclick = () => slot.classList.toggle('selected');
                }
                slot.textContent = slotTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                dayColumn.appendChild(slot);
            }
            timeSlotGridContainer.appendChild(dayColumn);
        }
    }

    availabilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedSlots = document.querySelectorAll('.time-slot.selected');
        if (selectedSlots.length === 0) return alert('Please select at least one time slot.');
        const clientEmail = availabilityClientEmailInput.value;
        if (!clientEmail) {
            return alert('Please select a client with an email address.');
        }
        const offered_slots = Array.from(selectedSlots).map(slot => ({ start: slot.dataset.time, end: new Date(new Date(slot.dataset.time).getTime() + 60 * 60 * 1000).toISOString() }));
        const payload = { client_email: clientEmail, service_type: document.getElementById('availability-service').value, offered_slots };
        const { error } = await supabase.functions.invoke('request-availability', { body: payload });
        if (error) alert('Failed to send request: ' + error.message); else { availabilityModal.close(); alert('Availability request sent successfully!'); }
    });

    document.getElementById('logout-button').addEventListener('click', () => { supabase.auth.signOut(); window.location.href = 'index.html' });
});