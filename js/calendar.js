// js/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    // These elements are on the calendar.html page
    const userInfo = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const appointmentModal = document.getElementById('appointment-modal');
    const appointmentForm = document.getElementById('appointment-form');
    const modalActionButtonContainer = document.getElementById('modal-action-buttons');

    let currentUser = null;
    let currentUserProfile = null;
    let calendar = null;
    
    // The 'supabase' constant is available globally because js/auth.js is loaded first.
    if (typeof supabase === 'undefined') {
        console.error('Supabase client is not loaded. Make sure auth.js is included before calendar.js');
        return;
    }

    // --- AUTHENTICATION & USER SETUP ---
    // This function now uses the global 'supabase' object
    const checkUserSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            // The redirect logic is already handled by auth.js, but this is a fallback.
            window.location.href = 'index.html';
            return;
        }
        currentUser = session.user;
        await loadUserProfile();
        await initializeCalendar();
        await populateTimeSlots();
        await populateStylists();
    };

    const loadUserProfile = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (data) {
            currentUserProfile = data;
            userInfo.textContent = `Welcome, ${data.full_name || currentUser.email} (${data.role})`;
        } else {
            userInfo.textContent = `Welcome, ${currentUser.email}`;
            console.error("Could not load user profile:", error);
        }
    };
    
    // --- UI & FORM HELPERS ---
    const populateTimeSlots = () => {
        const timeSelect = document.getElementById('modal-time');
        timeSelect.innerHTML = ''; // Clear existing options
        for (let i = 9; i <= 17; i++) { // 9 AM to 5 PM
            const time = `${String(i).padStart(2, '0')}:00`;
            const option = document.createElement('option');
            option.value = time;
            option.textContent = `${i > 12 ? i - 12 : i}:00 ${i >= 12 ? 'PM' : 'AM'}`;
            timeSelect.appendChild(option);
        }
    };

    const populateStylists = async () => {
        const stylistSelect = document.getElementById('modal-stylist');
        stylistSelect.innerHTML = '';
        const { data: stylists, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'stylist');
        
        if (error) {
            console.error('Error fetching stylists:', error);
            return;
        }

        stylists.forEach(stylist => {
            const option = document.createElement('option');
            option.value = stylist.id;
            option.textContent = stylist.full_name;
            stylistSelect.appendChild(option);
        });
    };

    // --- FULLCALENDAR SETUP ---
    const initializeCalendar = async () => {
        const calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: fetchAppointments,
            selectable: true,
            editable: false, 
            dateClick: handleDateClick,
            eventClick: handleEventClick,
            eventContent: function(arg) {
                // Add status to event element for CSS styling
                // A more robust way to add attributes
                const eventEl = arg.el;
                if (eventEl) {
                    eventEl.setAttribute('data-status', arg.event.extendedProps.status);
                }
                return { html: `<b>${arg.event.title}</b><br><i>${arg.event.extendedProps.status.replace(/_/g, ' ')}</i>` };
            }
        });
        calendar.render();
    };

    const fetchAppointments = async (fetchInfo, successCallback, failureCallback) => {
        const { data, error } = await supabase
            .from('appointments')
            .select('*, client:client_id(full_name), stylist:stylist_id(full_name)');
        
        if (error) {
            console.error('Error fetching appointments:', error);
            failureCallback(error);
            return;
        }

        const events = data.map(apt => ({
            id: apt.id,
            title: apt.title,
            start: apt.start_time,
            end: apt.end_time,
            extendedProps: {
                notes: apt.notes,
                clientId: apt.client_id,
                stylistId: apt.stylist_id,
                clientName: apt.client?.full_name,
                stylistName: apt.stylist?.full_name,
                status: apt.status
            }
        }));
        successCallback(events);
    };
    
    // --- MODAL & EVENT HANDLERS ---
    const openModalForNew = (date) => {
        appointmentForm.reset();
        document.getElementById('appointment-id').value = '';
        document.getElementById('modal-title').textContent = 'New Appointment';
        document.getElementById('modal-status').style.display = 'none';

        const localDate = new Date(date);
        document.getElementById('modal-date').value = localDate.toISOString().split('T')[0];
        const hour = localDate.getHours();
        if (hour >= 9 && hour <= 17) {
            document.getElementById('modal-time').value = `${String(hour).padStart(2, '0')}:00`;
        }

        if (currentUserProfile.role === 'client') {
            document.getElementById('modal-stylist').disabled = false;
        } else {
            document.getElementById('modal-stylist').value = currentUser.id;
            document.getElementById('modal-stylist').disabled = true;
        }
        
        renderActionButtons('new');
        appointmentModal.showModal();
    };

    const openModalForEdit = (eventInfo) => {
        appointmentForm.reset();
        const props = eventInfo.extendedProps;
        
        document.getElementById('modal-title').textContent = 'Appointment Details';
        document.getElementById('modal-status').style.display = 'block';
        document.getElementById('modal-status').className = props.status;
        document.getElementById('modal-status').textContent = props.status.replace(/_/g, ' ');

        document.getElementById('appointment-id').value = eventInfo.id;
        document.getElementById('modal-title-input').value = eventInfo.title;
        document.getElementById('modal-stylist').value = props.stylistId;
        document.getElementById('modal-notes').value = props.notes || '';

        const startDate = new Date(eventInfo.start);
        document.getElementById('modal-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('modal-time').value = `${String(startDate.getHours()).padStart(2, '0')}:00`;
        
        renderActionButtons(props.status);
        appointmentModal.showModal();
    };
    
    const handleDateClick = (info) => {
        if (currentUserProfile.role !== 'client') {
            alert('Only clients can create new appointments from the calendar.');
            return;
        }
        openModalForNew(info.dateStr);
    };

    const handleEventClick = (info) => {
        openModalForEdit(info.event);
    };

    const renderActionButtons = (status) => {
        modalActionButtonContainer.innerHTML = '';
        const isStylist = currentUserProfile.role === 'stylist';
        const closeButton = createButton('Close', 'button', 'button-secondary', () => appointmentModal.close());
        
        if (status === 'new') {
            const saveButton = createButton('Save', 'submit', 'btn-submit'); // Use a consistent button class
            modalActionButtonContainer.append(saveButton, closeButton);
        } else if (status === 'pending') {
            if (isStylist) {
                const confirmButton = createButton('Confirm', 'button', 'button-success', () => updateAppointmentStatus('confirmed'));
                const denyButton = createButton('Deny', 'button', 'button-danger', () => updateAppointmentStatus('cancelled_by_stylist'));
                modalActionButtonContainer.append(confirmButton, denyButton, closeButton);
            } else {
                const cancelButton = createButton('Cancel', 'button', 'button-danger', () => updateAppointmentStatus('cancelled_by_client'));
                modalActionButtonContainer.append(cancelButton, closeButton);
            }
        } else if (status === 'confirmed') {
             const newStatus = isStylist ? 'cancelled_by_stylist' : 'cancelled_by_client';
             const cancelButton = createButton('Cancel Appointment', 'button', 'button-danger', () => updateAppointmentStatus(newStatus));
             modalActionButtonContainer.append(cancelButton, closeButton);
        } else {
            modalActionButtonContainer.append(closeButton);
        }
    };
    
    const createButton = (text, type, className, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.type = type;
        button.className = className;
        if (onClick) button.onclick = onClick;
        return button;
    };
    
    // --- DATABASE OPERATIONS ---
    appointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('appointment-id').value;
        const title = document.getElementById('modal-title-input').value;
        const stylistId = document.getElementById('modal-stylist').value;
        const notes = document.getElementById('modal-notes').value;
        const date = document.getElementById('modal-date').value;
        const time = document.getElementById('modal-time').value;
        const start_time = new Date(`${date}T${time}:00`);
        const end_time = new Date(start_time.getTime() + 60 * 60 * 1000);

        const appointmentData = {
            client_id: currentUser.id,
            stylist_id: stylistId,
            start_time: start_time.toISOString(),
            end_time: end_time.toISOString(),
            title,
            notes,
            status: 'pending'
        };

        const { error } = await supabase.from('appointments').insert([appointmentData]);

        if (error) {
            console.error('Error saving appointment:', error);
            alert(`Error: ${error.message}`);
        } else {
            appointmentModal.close();
            calendar.refetchEvents();
        }
    });

    const updateAppointmentStatus = async (newStatus) => {
        const id = document.getElementById('appointment-id').value;
        if (!id) return;
        
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        
        if (error) {
            alert(`Error updating status: ${error.message}`);
        } else {
            appointmentModal.close();
            calendar.refetchEvents();
        }
    };

    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // --- INITIALIZE ---
    checkUserSession();
});