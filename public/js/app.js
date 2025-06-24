// API base URL
const API_BASE = '/api';

// Application state
let appState = {
    currentSection: 'dashboard',
    requests: [],
    factories: [],
    products: [],
    users: []
};

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        // Load initial data
        await Promise.all([
            loadRequests(),
            loadFactories(),
            loadProducts(),
            loadUsers()
        ]);
        
        // Update dashboard
        updateDashboard();
        updateRequestsTable();
        updateFactoriesList();
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError('アプリケーションの初期化に失敗しました');
    }
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.target.getAttribute('href').substring(1);
            showSection(sectionId);
        });
    });

    // New request button
    document.getElementById('new-request-btn').addEventListener('click', openNewRequestModal);

    // Status filter
    document.getElementById('status-filter').addEventListener('change', filterRequests);

    // Modal close
    document.querySelector('.close').addEventListener('click', closeModal);
    
    // Form submission
    document.getElementById('request-form').addEventListener('submit', submitRequest);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('request-modal');
        if (e.target === modal) {
            closeModal();
        }
    });
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    appState.currentSection = sectionId;
}

// API functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

async function loadRequests() {
    appState.requests = await apiCall('/requests');
}

async function loadFactories() {
    appState.factories = await apiCall('/factories');
}

async function loadProducts() {
    appState.products = await apiCall('/products');
}

async function loadUsers() {
    appState.users = await apiCall('/users');
}

// Dashboard functions
function updateDashboard() {
    const activeRequests = appState.requests.filter(req => 
        ['submitted', 'under_review', 'responded'].includes(req.status)
    ).length;
    
    const todayResponses = appState.requests.filter(req => {
        const today = new Date().toDateString();
        const updated = new Date(req.updated_at).toDateString();
        return today === updated && req.status === 'responded';
    }).length;
    
    const overdueRequests = appState.requests.filter(req => {
        const deadline = new Date(req.response_deadline);
        const now = new Date();
        return deadline < now && !['completed', 'rejected'].includes(req.status);
    }).length;

    document.getElementById('active-requests').textContent = activeRequests;
    document.getElementById('today-responses').textContent = todayResponses;
    document.getElementById('overdue-requests').textContent = overdueRequests;

    updateActivityList();
}

function updateActivityList() {
    const activityList = document.getElementById('activity-list');
    const recentRequests = appState.requests
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);

    if (recentRequests.length === 0) {
        activityList.innerHTML = '<p>最近の活動がありません</p>';
        return;
    }

    const html = recentRequests.map(request => {
        const factory = appState.factories.find(f => f.factory_id === request.factory_id);
        const factoryName = factory ? factory.factory_name : '不明な工場';
        const statusText = getStatusText(request.status);
        
        return `
            <div class="activity-item">
                <strong>${request.request_id}</strong> - ${factoryName}
                <span class="status-badge status-${request.status}">${statusText}</span>
                <small>${formatDate(request.updated_at)}</small>
            </div>
        `;
    }).join('');

    activityList.innerHTML = html;
}

// Request management functions
function updateRequestsTable() {
    const requestsTable = document.getElementById('requests-table');
    
    if (appState.requests.length === 0) {
        requestsTable.innerHTML = '<p>依頼がありません</p>';
        return;
    }

    const html = `
        <table>
            <thead>
                <tr>
                    <th>依頼ID</th>
                    <th>工場</th>
                    <th>製品</th>
                    <th>調整数量</th>
                    <th>ステータス</th>
                    <th>回答期限</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${appState.requests.map(request => createRequestRow(request)).join('')}
            </tbody>
        </table>
    `;

    requestsTable.innerHTML = html;
}

function createRequestRow(request) {
    const factory = appState.factories.find(f => f.factory_id === request.factory_id);
    const product = appState.products.find(p => p.product_id === request.product_id);
    const factoryName = factory ? factory.factory_name : '不明';
    const productName = product ? product.product_name : '不明';
    const statusText = getStatusText(request.status);

    return `
        <tr>
            <td>${request.request_id}</td>
            <td>${factoryName}</td>
            <td>${productName}</td>
            <td>${request.requested_quantity}</td>
            <td><span class="status-badge status-${request.status}">${statusText}</span></td>
            <td>${formatDate(request.response_deadline)}</td>
            <td>
                <button onclick="viewRequest('${request.request_id}')" class="btn-secondary">詳細</button>
            </td>
        </tr>
    `;
}

function filterRequests() {
    const filterValue = document.getElementById('status-filter').value;
    const filteredRequests = filterValue ? 
        appState.requests.filter(req => req.status === filterValue) : 
        appState.requests;
    
    // Temporarily update state for display
    const originalRequests = appState.requests;
    appState.requests = filteredRequests;
    updateRequestsTable();
    appState.requests = originalRequests;
}

// Factory management functions
function updateFactoriesList() {
    const factoriesList = document.getElementById('factories-list');
    
    if (appState.factories.length === 0) {
        factoriesList.innerHTML = '<p>工場データがありません</p>';
        return;
    }

    const html = appState.factories.map(factory => `
        <div class="factory-card">
            <h3>${factory.factory_name}</h3>
            <p><strong>所在地:</strong> ${factory.location || 'N/A'}</p>
            <p><strong>専門分野:</strong> ${factory.specialities || 'N/A'}</p>
            <p><strong>連絡先:</strong> ${factory.contact_email}</p>
            <p><strong>ステータス:</strong> 
                <span class="status-badge ${factory.status === 'active' ? 'status-approved' : 'status-rejected'}">
                    ${factory.status === 'active' ? '稼働中' : '停止中'}
                </span>
            </p>
        </div>
    `).join('');

    factoriesList.innerHTML = html;
}

// Modal functions
async function openNewRequestModal() {
    const modal = document.getElementById('request-modal');
    
    // Populate factory select
    const factorySelect = document.getElementById('factory-select');
    factorySelect.innerHTML = '<option value="">工場を選択してください</option>' +
        appState.factories
            .filter(f => f.status === 'active')
            .map(f => `<option value="${f.factory_id}">${f.factory_name}</option>`)
            .join('');

    // Populate product select
    const productSelect = document.getElementById('product-select');
    productSelect.innerHTML = '<option value="">製品を選択してください</option>' +
        appState.products.map(p => `<option value="${p.product_id}">${p.product_name}</option>`).join('');

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('request-modal').style.display = 'none';
    document.getElementById('request-form').reset();
}

async function submitRequest(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const requestData = {
        requester_id: 'USER001', // Default for MVP
        factory_id: document.getElementById('factory-select').value,
        product_id: document.getElementById('product-select').value,
        requested_quantity: parseInt(document.getElementById('requested-quantity').value),
        adjustment_type: document.getElementById('adjustment-type').value,
        priority: document.getElementById('priority').value,
        response_deadline: document.getElementById('response-deadline').value,
        delivery_deadline: document.getElementById('delivery-deadline').value,
        reason: document.getElementById('reason').value
    };

    try {
        await apiCall('/requests', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        showSuccess('依頼が正常に作成されました');
        closeModal();
        await loadRequests();
        updateDashboard();
        updateRequestsTable();
    } catch (error) {
        showError('依頼の作成に失敗しました: ' + error.message);
    }
}

// Utility functions
function getStatusText(status) {
    const statusMap = {
        'submitted': '送信済み',
        'under_review': '確認中',
        'responded': '回答済み',
        'approved': '承認済み',
        'rejected': '拒否',
        'completed': '完了'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showSuccess(message) {
    // Simple alert for MVP - can be enhanced with toast notifications
    alert('成功: ' + message);
}

function showError(message) {
    // Simple alert for MVP - can be enhanced with toast notifications
    alert('エラー: ' + message);
}

function viewRequest(requestId) {
    // For MVP - simple alert with request details
    const request = appState.requests.find(r => r.request_id === requestId);
    if (request) {
        alert(`依頼詳細:\n${JSON.stringify(request, null, 2)}`);
    }
}

function generateReport(type) {
    const reportContent = document.getElementById('report-content');
    
    switch (type) {
        case 'status':
            generateStatusReport(reportContent);
            break;
        case 'factory':
            generateFactoryReport(reportContent);
            break;
        case 'timeline':
            generateTimelineReport(reportContent);
            break;
    }
}

function generateStatusReport(container) {
    const statusCounts = appState.requests.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
    }, {});

    const html = `
        <h3>ステータス別レポート</h3>
        <table>
            <thead>
                <tr><th>ステータス</th><th>件数</th></tr>
            </thead>
            <tbody>
                ${Object.entries(statusCounts).map(([status, count]) => 
                    `<tr><td>${getStatusText(status)}</td><td>${count}</td></tr>`
                ).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = html;
}

function generateFactoryReport(container) {
    const factoryCounts = appState.requests.reduce((acc, req) => {
        const factory = appState.factories.find(f => f.factory_id === req.factory_id);
        const factoryName = factory ? factory.factory_name : '不明';
        acc[factoryName] = (acc[factoryName] || 0) + 1;
        return acc;
    }, {});

    const html = `
        <h3>工場別レポート</h3>
        <table>
            <thead>
                <tr><th>工場名</th><th>依頼件数</th></tr>
            </thead>
            <tbody>
                ${Object.entries(factoryCounts).map(([factory, count]) => 
                    `<tr><td>${factory}</td><td>${count}</td></tr>`
                ).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = html;
}

function generateTimelineReport(container) {
    const sortedRequests = [...appState.requests].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );

    const html = `
        <h3>タイムラインレポート</h3>
        <div>
            ${sortedRequests.map(req => {
                const factory = appState.factories.find(f => f.factory_id === req.factory_id);
                const factoryName = factory ? factory.factory_name : '不明';
                return `
                    <div style="border-left: 3px solid #3498db; padding-left: 15px; margin-bottom: 15px;">
                        <strong>${req.request_id}</strong> - ${factoryName}<br>
                        <small>${formatDate(req.created_at)}</small><br>
                        <span class="status-badge status-${req.status}">${getStatusText(req.status)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    container.innerHTML = html;
}