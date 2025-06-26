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
        updateProductsList();
        
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

    // New factory button
    document.getElementById('new-factory-btn').addEventListener('click', openNewFactoryModal);
    
    // New product button
    document.getElementById('new-product-btn').addEventListener('click', openNewProductModal);

    // Load sample data button
    document.getElementById('load-sample-data-btn').addEventListener('click', loadSampleData);

    // Status filter
    document.getElementById('status-filter').addEventListener('change', filterRequests);

    // Modal close buttons and actions using event delegation
    document.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        switch (action) {
            case 'close-modal':
                closeModal();
                break;
            case 'close-details-modal':
                closeDetailsModal();
                break;
            case 'close-factory-modal':
                closeFactoryModal();
                break;
            case 'close-product-modal':
                closeProductModal();
                break;
            case 'view-request':
                const requestId = e.target.getAttribute('data-request-id');
                if (requestId) viewRequest(requestId);
                break;
            case 'edit-factory':
                const editFactoryId = e.target.getAttribute('data-factory-id');
                if (editFactoryId) editFactory(editFactoryId);
                break;
            case 'delete-factory':
                const deleteFactoryId = e.target.getAttribute('data-factory-id');
                if (deleteFactoryId) deleteFactory(deleteFactoryId);
                break;
            case 'edit-product':
                const editProductId = e.target.getAttribute('data-product-id');
                if (editProductId) editProduct(editProductId);
                break;
            case 'delete-product':
                const deleteProductId = e.target.getAttribute('data-product-id');
                if (deleteProductId) deleteProduct(deleteProductId);
                break;
        }
        
        // Handle report generation buttons
        const reportType = e.target.getAttribute('data-report-type');
        if (reportType) {
            generateReport(reportType);
        }
    });

    // Keep the original close button for compatibility (first one)
    const firstCloseButton = document.querySelector('.close');
    if (firstCloseButton && !firstCloseButton.hasAttribute('data-action')) {
        firstCloseButton.addEventListener('click', closeModal);
    }
    
    // Form submissions
    document.getElementById('request-form').addEventListener('submit', submitRequest);
    document.getElementById('factory-form').addEventListener('submit', submitFactory);
    document.getElementById('product-form').addEventListener('submit', submitProduct);

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const requestModal = document.getElementById('request-modal');
        const detailsModal = document.getElementById('request-details-modal');
        const factoryModal = document.getElementById('factory-modal');
        const productModal = document.getElementById('product-modal');
        
        if (e.target === requestModal) {
            closeModal();
        } else if (e.target === detailsModal) {
            closeDetailsModal();
        } else if (e.target === factoryModal) {
            closeFactoryModal();
        } else if (e.target === productModal) {
            closeProductModal();
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

// Sample data loading function
async function loadSampleData() {
    try {
        showSuccess('サンプルデータの読み込みを開始します...');
        
        // Call the load sample data endpoint
        await apiCall('/load-sample-data', {
            method: 'POST'
        });
        
        // Reload all data after sample data is loaded
        await Promise.all([
            loadRequests(),
            loadFactories(),
            loadProducts(),
            loadUsers()
        ]);
        
        // Update all UI components
        updateDashboard();
        updateRequestsTable();
        updateFactoriesList();
        updateProductsList();
        
        showSuccess('サンプルデータが正常にロードされました');
        
    } catch (error) {
        console.error('Failed to load sample data:', error);
        showError('サンプルデータの読み込みに失敗しました: ' + error.message);
    }
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
    
    // Get current filter value
    const filterValue = document.getElementById('status-filter').value;
    
    // Apply filter if set
    const displayRequests = filterValue ? 
        appState.requests.filter(req => req.status === filterValue) : 
        appState.requests;
    
    if (displayRequests.length === 0) {
        requestsTable.innerHTML = filterValue ? 
            '<p>選択されたステータスの依頼がありません</p>' : 
            '<p>依頼がありません</p>';
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
                ${displayRequests.map(request => createRequestRow(request)).join('')}
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
                <button data-action="view-request" data-request-id="${request.request_id}" class="btn-secondary">詳細</button>
            </td>
        </tr>
    `;
}

function filterRequests() {
    // Simply refresh the table - the filtering logic is now in updateRequestsTable()
    updateRequestsTable();
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
            <p><strong>コード:</strong> ${factory.factory_code}</p>
            <p><strong>所在地:</strong> ${factory.location || 'N/A'}</p>
            <p><strong>専門分野:</strong> ${factory.specialities || 'N/A'}</p>
            <p><strong>連絡先:</strong> ${factory.contact_email}</p>
            <p><strong>生産能力:</strong> ${factory.production_capacity || 'N/A'}</p>
            <p><strong>ステータス:</strong> 
                <span class="status-badge ${factory.status === 'active' ? 'status-approved' : 'status-rejected'}">
                    ${factory.status === 'active' ? '稼働中' : '停止中'}
                </span>
            </p>
            <div class="card-actions">
                <button data-action="edit-factory" data-factory-id="${factory.factory_id}" class="btn-secondary">編集</button>
                <button data-action="delete-factory" data-factory-id="${factory.factory_id}" class="btn-danger">削除</button>
            </div>
        </div>
    `).join('');

    factoriesList.innerHTML = html;
}

// Product management functions
function updateProductsList() {
    const productsList = document.getElementById('products-list');
    
    if (appState.products.length === 0) {
        productsList.innerHTML = '<p>製品データがありません</p>';
        return;
    }

    const html = appState.products.map(product => `
        <div class="product-card">
            <h3>${product.product_name}</h3>
            <p><strong>コード:</strong> ${product.product_code}</p>
            <p><strong>カテゴリー:</strong> ${product.category}</p>
            <p><strong>単位:</strong> ${product.unit || 'N/A'}</p>
            <p><strong>リードタイム:</strong> ${product.standard_lead_time || 'N/A'} 日</p>
            <p><strong>最小注文数量:</strong> ${product.minimum_order_quantity || 'N/A'}</p>
            <p><strong>必要材料:</strong> ${product.required_materials || 'N/A'}</p>
            <p><strong>説明:</strong> ${product.description || 'N/A'}</p>
            <p><strong>ステータス:</strong> 
                <span class="status-badge ${product.status === 'active' ? 'status-approved' : 'status-rejected'}">
                    ${product.status === 'active' ? '有効' : '無効'}
                </span>
            </p>
            <div class="card-actions">
                <button data-action="edit-product" data-product-id="${product.product_id}" class="btn-secondary">編集</button>
                <button data-action="delete-product" data-product-id="${product.product_id}" class="btn-danger">削除</button>
            </div>
        </div>
    `).join('');

    productsList.innerHTML = html;
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

function getPriorityText(priority) {
    const priorityMap = {
        'high': '高',
        'medium': '中',
        'low': '低'
    };
    return priorityMap[priority] || priority;
}

function getAdjustmentTypeText(adjustmentType) {
    const typeMap = {
        'increase': '増産',
        'decrease': '減産'
    };
    return typeMap[adjustmentType] || adjustmentType;
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
    const request = appState.requests.find(r => r.request_id === requestId);
    if (!request) {
        showError('依頼が見つかりません');
        return;
    }

    const factory = appState.factories.find(f => f.factory_id === request.factory_id);
    const product = appState.products.find(p => p.product_id === request.product_id);
    const user = appState.users.find(u => u.user_id === request.requester_id);

    const factoryName = factory ? factory.factory_name : '不明な工場';
    const productName = product ? product.product_name : '不明な製品';
    const userName = user ? user.user_name : '不明なユーザー';
    const statusText = getStatusText(request.status);
    const priorityText = getPriorityText(request.priority);
    const adjustmentTypeText = getAdjustmentTypeText(request.adjustment_type);

    const detailsContent = `
        <div class="request-details-grid">
            <div class="detail-section">
                <h3>基本情報</h3>
                <div class="detail-row">
                    <label>依頼ID:</label>
                    <span>${request.request_id}</span>
                </div>
                <div class="detail-row">
                    <label>依頼者:</label>
                    <span>${userName}</span>
                </div>
                <div class="detail-row">
                    <label>作成日時:</label>
                    <span>${formatDate(request.created_at)}</span>
                </div>
                <div class="detail-row">
                    <label>更新日時:</label>
                    <span>${formatDate(request.updated_at)}</span>
                </div>
            </div>

            <div class="detail-section">
                <h3>依頼内容</h3>
                <div class="detail-row">
                    <label>工場:</label>
                    <span>${factoryName}</span>
                </div>
                <div class="detail-row">
                    <label>製品:</label>
                    <span>${productName}</span>
                </div>
                <div class="detail-row">
                    <label>調整タイプ:</label>
                    <span>${adjustmentTypeText}</span>
                </div>
                <div class="detail-row">
                    <label>調整数量:</label>
                    <span>${request.requested_quantity.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <label>優先度:</label>
                    <span class="priority-${request.priority}">${priorityText}</span>
                </div>
            </div>

            <div class="detail-section">
                <h3>スケジュール</h3>
                <div class="detail-row">
                    <label>回答期限:</label>
                    <span>${formatDate(request.response_deadline)}</span>
                </div>
                <div class="detail-row">
                    <label>納期:</label>
                    <span>${formatDate(request.delivery_deadline)}</span>
                </div>
            </div>

            <div class="detail-section">
                <h3>ステータス・理由</h3>
                <div class="detail-row">
                    <label>現在のステータス:</label>
                    <span class="status-badge status-${request.status}">${statusText}</span>
                </div>
                <div class="detail-row">
                    <label>理由:</label>
                    <div class="reason-text">${request.reason || 'N/A'}</div>
                </div>
                ${request.factory_response ? `
                <div class="detail-row">
                    <label>工場回答:</label>
                    <div class="response-text">${request.factory_response}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    document.getElementById('request-details-content').innerHTML = detailsContent;
    document.getElementById('request-details-modal').style.display = 'block';
}

function closeDetailsModal() {
    document.getElementById('request-details-modal').style.display = 'none';
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

// Factory modal functions
function openNewFactoryModal() {
    document.getElementById('factory-modal-title').textContent = '新規工場追加';
    document.getElementById('factory-form').reset();
    document.getElementById('factory-form').removeAttribute('data-factory-id');
    document.getElementById('factory-modal').style.display = 'block';
}

function editFactory(factoryId) {
    const factory = appState.factories.find(f => f.factory_id === factoryId);
    if (!factory) return;
    
    document.getElementById('factory-modal-title').textContent = '工場編集';
    document.getElementById('factory-form').setAttribute('data-factory-id', factoryId);
    
    // Populate form fields
    document.getElementById('factory-name').value = factory.factory_name || '';
    document.getElementById('factory-code').value = factory.factory_code || '';
    document.getElementById('factory-location').value = factory.location || '';
    document.getElementById('factory-contact-person').value = factory.contact_person || '';
    document.getElementById('factory-contact-email').value = factory.contact_email || '';
    document.getElementById('factory-contact-phone').value = factory.contact_phone || '';
    document.getElementById('factory-production-capacity').value = factory.production_capacity || '';
    document.getElementById('factory-specialities').value = factory.specialities || '';
    document.getElementById('factory-status').value = factory.status || 'active';
    
    document.getElementById('factory-modal').style.display = 'block';
}

function closeFactoryModal() {
    document.getElementById('factory-modal').style.display = 'none';
    document.getElementById('factory-form').reset();
}

async function submitFactory(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const factoryData = Object.fromEntries(formData.entries());
    const factoryId = e.target.getAttribute('data-factory-id');
    
    try {
        let result;
        if (factoryId) {
            // Update existing factory
            result = await apiCall(`/factories/${factoryId}`, {
                method: 'PUT',
                body: JSON.stringify(factoryData)
            });
        } else {
            // Create new factory
            result = await apiCall('/factories', {
                method: 'POST',
                body: JSON.stringify(factoryData)
            });
        }
        
        showSuccess(factoryId ? '工場を更新しました' : '新規工場を追加しました');
        closeFactoryModal();
        await loadFactories();
        updateFactoriesList();
    } catch (error) {
        console.error('Error saving factory:', error);
        showError('工場の保存に失敗しました');
    }
}

async function deleteFactory(factoryId) {
    if (!confirm('この工場を削除してもよろしいですか？')) return;
    
    try {
        await apiCall(`/factories/${factoryId}`, {
            method: 'DELETE'
        });
        
        showSuccess('工場を削除しました');
        await loadFactories();
        updateFactoriesList();
    } catch (error) {
        console.error('Error deleting factory:', error);
        showError('工場の削除に失敗しました');
    }
}

// Product modal functions
function openNewProductModal() {
    document.getElementById('product-modal-title').textContent = '新規製品追加';
    document.getElementById('product-form').reset();
    document.getElementById('product-form').removeAttribute('data-product-id');
    document.getElementById('product-modal').style.display = 'block';
}

function editProduct(productId) {
    const product = appState.products.find(p => p.product_id === productId);
    if (!product) return;
    
    document.getElementById('product-modal-title').textContent = '製品編集';
    document.getElementById('product-form').setAttribute('data-product-id', productId);
    
    // Populate form fields
    document.getElementById('product-name').value = product.product_name || '';
    document.getElementById('product-code').value = product.product_code || '';
    document.getElementById('product-category').value = product.category || '';
    document.getElementById('product-unit').value = product.unit || '';
    document.getElementById('product-lead-time').value = product.standard_lead_time || '';
    document.getElementById('product-min-quantity').value = product.minimum_order_quantity || '';
    document.getElementById('product-materials').value = product.required_materials || '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-status').value = product.status || 'active';
    
    document.getElementById('product-modal').style.display = 'block';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
    document.getElementById('product-form').reset();
}

async function submitProduct(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const productData = Object.fromEntries(formData.entries());
    const productId = e.target.getAttribute('data-product-id');
    
    try {
        let result;
        if (productId) {
            // Update existing product
            result = await apiCall(`/products/${productId}`, {
                method: 'PUT',
                body: JSON.stringify(productData)
            });
        } else {
            // Create new product
            result = await apiCall('/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });
        }
        
        showSuccess(productId ? '製品を更新しました' : '新規製品を追加しました');
        closeProductModal();
        await loadProducts();
        updateProductsList();
    } catch (error) {
        console.error('Error saving product:', error);
        showError('製品の保存に失敗しました');
    }
}

async function deleteProduct(productId) {
    if (!confirm('この製品を削除してもよろしいですか？')) return;
    
    try {
        await apiCall(`/products/${productId}`, {
            method: 'DELETE'
        });
        
        showSuccess('製品を削除しました');
        await loadProducts();
        updateProductsList();
    } catch (error) {
        console.error('Error deleting product:', error);
        showError('製品の削除に失敗しました');
    }
}