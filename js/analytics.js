document.addEventListener('DOMContentLoaded', async () => {
    // --- AUTHENTICATION ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // --- GLOBAL DATA & CONFIG ---
    let allAppointments = [];
    const CHART_COLORS = ['#6d28d9', '#db2777', '#059669', '#d97706', '#2563eb', '#be185d', '#8b5cf6', '#16a34a', '#f59e0b', '#3b82f6'];
    let appointmentsChartDateRange = {}; // Store the current date range for the line chart

    // --- MODAL ELEMENTS & CONTROLS ---
    const detailsModal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    function openModal(title, contentHtml) {
        modalTitle.textContent = title;
        modalBody.innerHTML = contentHtml;
        detailsModal.classList.remove('hidden');
    }

    function closeModal() {
        detailsModal.classList.add('hidden');
    }

    modalCloseBtn.addEventListener('click', closeModal);
    detailsModal.addEventListener('click', (event) => {
        if (event.target === detailsModal) {
            closeModal();
        }
    });

    // --- DATA FETCHING & INITIALIZATION ---
    async function loadAnalytics() {
        const [appointmentsRes, clientsRes] = await Promise.all([
            supabase.from('appointments').select('*, client:clients(name, created_at)'),
            supabase.from('clients').select('created_at')
        ]);

        if (appointmentsRes.error || clientsRes.error) {
            console.error('Error fetching data:', appointmentsRes.error || clientsRes.error);
            return;
        }

        allAppointments = appointmentsRes.data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        const clients = clientsRes.data;

        displayKPIs(allAppointments, clients);
        displayStaticCharts(allAppointments);
        initializeDynamicCharts(allAppointments);
    }

    // --- KPI & CHART RENDERING ---
    function displayKPIs(appointments, clients) { /* ... NO CHANGES IN THIS FUNCTION ... */ }
    function displayStaticCharts(appointments) { /* ... NO CHANGES IN THIS FUNCTION ... */ }
    function initializeDynamicCharts(appointments) { /* ... NO CHANGES IN THIS FUNCTION ... */ }
    // (Pasting the full functions below for completeness)

    function displayKPIs(appointments, clients) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyAppointments = appointments.filter(apt => new Date(apt.start_time) >= startOfMonth);
        document.getElementById('kpi-monthly-appointments').textContent = monthlyAppointments.length;

        const newClients = clients.filter(client => new Date(client.created_at) >= startOfMonth);
        document.getElementById('kpi-new-clients').textContent = newClients.length;

        const serviceCounts = {};
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        appointments.forEach(apt => {
            serviceCounts[apt.service_type] = (serviceCounts[apt.service_type] || 0) + 1;
            dayCounts[new Date(apt.start_time).getDay()]++;
        });

        const mostPopularService = Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b, 'N/A');
        const busiestDayIndex = dayCounts.indexOf(Math.max(...dayCounts));

        document.getElementById('kpi-popular-service').textContent = mostPopularService;
        document.getElementById('kpi-busiest-day').textContent = dayNames[busiestDayIndex];
    }

    function displayStaticCharts(appointments) {
        const serviceCounts = {};
        appointments.forEach(apt => {
            serviceCounts[apt.service_type] = (serviceCounts[apt.service_type] || 0) + 1;
        });
        renderChart('services-chart', 'doughnut', Object.keys(serviceCounts), Object.values(serviceCounts), 'Services');

        const clientCounts = {};
        appointments.forEach(apt => {
            if (apt.client) {
                clientCounts[apt.client.name] = (clientCounts[apt.client.name] || 0) + 1;
            }
        });
        const sortedClients = Object.entries(clientCounts).sort(([, a], [, b]) => b - a).slice(0, 10);
        renderChart('top-clients-chart', 'bar', sortedClients.map(c => c[0]), sortedClients.map(c => c[1]), 'Appointments');

        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        appointments.forEach(apt => {
            dayCounts[new Date(apt.start_time).getDay()]++;
        });
        renderChart('weekly-trends-chart', 'bar', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], dayCounts, 'Bookings');
    }

    function initializeDynamicCharts(appointments) {
        const today = new Date();
        const defaultStartDate = new Date(new Date().setDate(today.getDate() - 5));
        const defaultEndDate = new Date(new Date().setDate(today.getDate() + 5));
        
        updateAppointmentsOverTimeChart(appointments, defaultStartDate, defaultEndDate);

        flatpickr("#appointments-date-range", {
            mode: "range",
            dateFormat: "M j, Y",
            defaultDate: [defaultStartDate, defaultEndDate],
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    updateAppointmentsOverTimeChart(allAppointments, selectedDates[0], selectedDates[1]);
                }
            }
        });
    }

    function updateAppointmentsOverTimeChart(appointments, startDate, endDate) {
        appointmentsChartDateRange = { start: startDate, end: endDate }; // Store for click handling
        
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const filteredAppointments = appointments.filter(apt => new Date(apt.start_time) >= startDate && new Date(apt.start_time) <= endOfDay);
        
        const dailyCounts = new Map();
        filteredAppointments.forEach(apt => {
            const dayKey = new Date(apt.start_time).setHours(0, 0, 0, 0);
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
        });

        const labels = [], data = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const dayKey = new Date(d).setHours(0, 0, 0, 0);
            data.push(dailyCounts.get(dayKey) || 0);
        }
        renderChart('appointments-chart', 'line', labels, data, 'Appointments');
    }

    // --- CHART CLICK HANDLER ---
    function handleChartClick(canvasId, label, dataIndex) {
        let title = '';
        let appointmentsToShow = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        switch (canvasId) {
            case 'top-clients-chart':
                title = `Appointments for ${label}`;
                appointmentsToShow = allAppointments.filter(apt => apt.client && apt.client.name === label);
                break;

            case 'services-chart':
                title = `Appointments for ${label}`;
                appointmentsToShow = allAppointments.filter(apt => apt.service_type === label);
                break;

            case 'weekly-trends-chart':
                title = `Appointments on a ${dayNames[dataIndex]}`;
                appointmentsToShow = allAppointments.filter(apt => new Date(apt.start_time).getDay() === dataIndex);
                break;
            
            case 'appointments-chart':
                const clickedDate = new Date(appointmentsChartDateRange.start);
                clickedDate.setDate(clickedDate.getDate() + dataIndex);
                title = `Appointments on ${clickedDate.toLocaleDateString()}`;
                appointmentsToShow = allAppointments.filter(apt => {
                    const aptDate = new Date(apt.start_time);
                    return aptDate.getFullYear() === clickedDate.getFullYear() &&
                           aptDate.getMonth() === clickedDate.getMonth() &&
                           aptDate.getDate() === clickedDate.getDate();
                });
                break;

            default:
                return; // Do nothing for other charts
        }

        if (appointmentsToShow.length === 0) {
            openModal(title, '<p>No specific appointments to show for this selection.</p>');
            return;
        }

        // Format the appointments into an HTML list
        const contentHtml = `
            <ul class="modal-list">
                ${appointmentsToShow.map(apt => `
                    <li class="modal-list-item">
                        <span class="item-label">${apt.client ? apt.client.name : 'N/A'} - ${apt.service_type}</span>
                        <span class="item-value">${new Date(apt.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </li>
                `).join('')}
            </ul>`;
        
        openModal(title, contentHtml);
    }


    // --- GENERIC CHART RENDERER (MODIFIED) ---
    function renderChart(canvasId, type, labels, data, dataLabel) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (Chart.getChart(canvasId)) {
            Chart.getChart(canvasId).destroy();
        }
        
        const chart = new Chart(ctx, {
            type: type,
            data: { labels, datasets: [{ label: dataLabel, data, borderColor: type === 'line' ? '#6d28d9' : '#ffffff', borderWidth: type === 'line' ? 2 : 1, tension: 0.2, fill: type === 'line', backgroundColor: type === 'line' ? 'rgba(109, 40, 217, 0.1)' : CHART_COLORS }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: type === 'doughnut' ? 'bottom' : 'none' } },
                scales: (type === 'bar' || type === 'line') ? { y: { beginAtZero: true, grace: '10%' } } : {},
                // --- ADDED ONCLICK HANDLER ---
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const dataIndex = elements[0].index;
                        const label = chart.data.labels[dataIndex];
                        handleChartClick(canvasId, label, dataIndex);
                    }
                }
            }
        });
    }

    // --- INITIALIZE ---
    loadAnalytics();
});