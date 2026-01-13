import { loginUser, 
    registerUser, 
    getActiveDepartmentNames, 
    fetchNotices, 
    verifyTeacher,
    fetchNoticesByDepartment ,
    searchNoticesByKeyword ,
    fetchNoticesByDateRange,
    searchNoticesBackend,
    getAdminTeachers,
    uploadNotice,
    updateTeacherAdminStatus,
    searchStudents,
    updateStudentPassword,
    updateStudentEmail,
    getStudentsByDepartment,
    updateDepartmentName,
    addDepartment,
    deleteDepartment,
    deleteNoticeById,
    fetchAllQueries,
    fetchResolvedQueries,
    fetchUnresolvedQueries,
    resolveQuery,
    getQueryById,
    submitHelpQuery,
    logoutUser,
    resetPassword,
    downloadQueryReport,
    downloadDepartmentReport,
    downloadDepartmentNoticeReport
} from "./apis.js";

/* =====================================================
   GLOBAL HTTP INTERCEPTOR (FETCH) + SPINNER
   ===================================================== */

(function () {

    /* ---------- Inject Spinner HTML + CSS ---------- */
    const spinner = document.createElement("div");
    spinner.id = "global-spinner";
    spinner.innerHTML = `
        <div class="spinner-backdrop">
            <div class="spinner"></div>
        </div>
    `;

    const style = document.createElement("style");
    style.innerHTML = `
        .spinner-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .spinner {
            width: 60px;
            height: 60px;
            border: 6px solid #ddd;
            border-top: 6px solid #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        #global-spinner {
            display: none;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(spinner);

    /* ---------- Spinner control ---------- */
    let pendingRequests = 0;

    function showSpinner() {
        spinner.style.display = "block";
    }

    function hideSpinner() {
        spinner.style.display = "none";
    }

    /* ---------- FETCH INTERCEPTOR ---------- */
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        pendingRequests++;
        showSpinner();

        try {
            const response = await originalFetch.apply(this, args);
            return response;
        } catch (error) {
            throw error;
        } finally {
            pendingRequests--;
            if (pendingRequests <= 0) {
                hideSpinner();
            }
        }
    };

})();


// ================= GLOBAL UI STATE =================
let currentPage = 1;
let noticesPerPage = 15;
let totalPages = 1;
let notices = [];
let filteredNotices = [];
let currentUser = null;
let selectedDeptId = null;

// Get modal elements
const queryModal = document.getElementById("queryModal");
const modalQueryId = document.getElementById("modalQueryId");
const modalQueryTitle = document.getElementById("modalQueryTitle");
const modalQueryDescription = document.getElementById("modalQueryDescription");
const modalQuerySender = document.getElementById("modalQuerySender");
const modalQueryCreatedAt = document.getElementById("modalQueryCreatedAt");
const modalQueryStatus = document.getElementById("modalQueryStatus");
const modalQueryResolvedBy = document.getElementById("modalQueryResolvedBy");
const closeModalBtn = document.querySelector(".close-btn");

// ================= PAGE ROUTER =================
document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop() || 'login.html';

    loadStoredUser();
    initCommonFeatures();


    switch (page) {
        case 'login.html': initLoginPage(); break;
        case 'register.html': initRegisterPage(); break;
        case 'reset-password.html': initResetPasswordPage(); break;
        case 'main.html': initMainPage(); break;
        case 'teachers-corner.html': initTeachersCorner(); break;
        case 'help.html': initHelpPage(); break;
    }
});

// ================= COMMON =================
function loadStoredUser() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        try {
            currentUser = JSON.parse(user);
        } catch (e) {
            console.error('Error parsing stored user:', e);
            currentUser = null;
        }
    }
}

function initCommonFeatures() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input && input.type) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });
    });
}

function showNotification(msg, type = 'info') {
    const box = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    if (!box || !notificationMessage) {
        console.log(`Notification (${type}): ${msg}`);
        return;
    }

    notificationMessage.textContent = msg;
    box.className = `notification ${type}`;
    box.style.display = 'flex';
    
    setTimeout(() => {
        box.style.display = 'none';
    }, 3000);
}

function redirectLogin() {
    location.href = 'login.html';
}

// ================= LOGIN =================
function initLoginPage() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const email = form.email.value.trim();
        const password = form.password.value.trim();
        const role = form.isTeacher?.checked ? "TEACHER" : "STUDENT";

        if (!email || !password) {
            showNotification('All fields required', 'error');
            return;
        }

        try {
            const res = await loginUser(email, password, role);

            localStorage.setItem('currentUser', JSON.stringify({
                name: res.name,
                email: res.email,
                token: res.token,
                isAdmin: res.isAdmin,
                role: res.role || role
            }));

            showNotification(`Login successful! Welcome, ${res.name}`, 'success');
            setTimeout(() => location.href = 'main.html', 1000);

        } catch (err) {
            showNotification(`Login failed: ${err.message}`, 'error');
        }
    });
}

// ================= REGISTER =================
async function initRegisterPage() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Populate departments dropdown
    const departmentSelect = document.getElementById("department");
    if (departmentSelect) {
        try {
            const departments = await getActiveDepartmentNames();
            departmentSelect.innerHTML = '<option value="">Select department</option>';

            departments.forEach(d => {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = d.name;
                departmentSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to load departments:', err);
            showNotification('Failed to load departments', 'error');
        }
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            password: form.password.value,
            confirmPassword: form.confirmPassword.value,
            role: form.role.value,
            departmentId: Number(form.department.value)
        };

        if (Object.values(data).some(v => v === "" || v === null || v === undefined)) {
            showNotification('All fields required', 'error');
            return;
        }

        if (data.password !== data.confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        try {
            const res = await registerUser(data);

            localStorage.setItem('currentUser', JSON.stringify({
                name: res.name,
                email: res.email,
                token: res.token,
                isAdmin: res.isAdmin,
                role: data.role
            }));

            showNotification(`Registration successful! Welcome, ${res.name}`, 'success');
            setTimeout(() => location.href = 'login.html', 1500);

        } catch (err) {
            let msg = err.message;
            if (err.response && err.response.data) {
                msg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
            }
            showNotification(`Registration failed: ${msg}`, 'error');
        }
    });
}
// ================= RESET PASSWORD =================
function initResetPasswordPage() {
    const form = document.getElementById('resetPasswordForm');
    const togglePasswordBtn = document.getElementById('toggleNewPassword');
    
    if (!form) return;

    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('newPassword');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                passwordInput.type = 'password';
                togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const email = form.email.value.trim();
        const newPassword = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        // Validation
        if (!email || !newPassword || !confirmPassword) {
            showNotification('All fields are required', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showNotification('Password must be at least 4 characters', 'error');
            return;
        }

        try {
            // Show loading state
            const submitBtn = form.querySelector('.btn-primary');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
            submitBtn.disabled = true;

            // Call reset password API
            const result = await resetPassword(email, newPassword, confirmPassword);
            
            showNotification(result.message || 'Password reset successful!', 'success');
            
            // Clear form
            form.reset();
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (err) {
            // Reset button
            const submitBtn = form.querySelector('.btn-primary');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Reset Password';
            submitBtn.disabled = false;
            
            // Show error message
            let errorMsg = err.message;
            if (err.response && err.response.data) {
                errorMsg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
            }
            showNotification(`Password reset failed: ${errorMsg}`, 'error');
        }
    });
}
// ================= MAIN PAGE =================
async function initMainPage() {
    if (!currentUser) {
        redirectLogin();
        return;
    }

    initUserPanel();
    initSearch();
    initPagination();
    initFilters();
    initSidebar();
    initTeachersCornerButton();
 await initDepartmentFilter();
    initDepartmentApplyButton();
    initHeaderButtons();

    initDateRangeFilter();
     initLogout(); // Add this line


    try {
        notices = await fetchNotices();
        filteredNotices = [...notices];
        displayNotices();
    } catch (err) {
        console.error('Failed to fetch notices:', err);
        const container = document.getElementById('noticesContainer');
        if (container) {
            container.innerHTML = `<p class="no-data">Failed to load notices: ${err.message}</p>`;
        }
    }
}
// ================= LOGOUT =================
function initLogout() {
    const logoutButton = document.getElementById('logoutButton');
    if (!logoutButton) return;

    logoutButton.addEventListener('click', async () => {
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to logout?');
        
        if (!confirmed) {
            return; // User clicked Cancel
        }

        try {
            // Show loading state
            logoutButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
            logoutButton.disabled = true;

            // Call logout API
            const result = await logoutUser();
            console.log('Logout result:', result);

            // Clear user data from localStorage
            localStorage.removeItem('currentUser');
            
            // Show success message
            showNotification('Logged out successfully!', 'success');
            
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);

        } catch (error) {
            console.error('Logout failed:', error);
            
            // Reset button state
            logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
            logoutButton.disabled = false;
            
            // Show error message
            showNotification('Logout failed. Please try again.', 'error');
        }
    });
}

function initUserPanel() {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');

    if (userName) userName.textContent = currentUser.name || 'Unknown';
    if (userEmail) userEmail.textContent = currentUser.email || 'No email';
    if (userRole) userRole.textContent = currentUser.role || 'Unknown role';
}

// ================= NOTICE DISPLAY =================
function displayNotices() {
    const container = document.getElementById('noticesContainer');
    if (!container) return;

    const start = (currentPage - 1) * noticesPerPage;
    const pageData = filteredNotices.slice(start, start + noticesPerPage);
    totalPages = Math.max(1, Math.ceil(filteredNotices.length / noticesPerPage));

    container.innerHTML = '';

    if (!pageData.length) {
        container.innerHTML = `<p class="no-data">No notices found</p>`;
        updatePagination();
        return;
    }

    pageData.forEach(notice => {
        const card = createNoticeCard(notice);
        container.appendChild(card);
    });

    updatePagination();
}

function createNoticeCard(notice) {
    const div = document.createElement('div');
    div.className = 'notice-card';

    const validTill = notice.validTill ? new Date(notice.validTill).toLocaleDateString() : 'N/A';
    const createdAt = notice.createdAt ? new Date(notice.createdAt).toLocaleDateString() : 'N/A';
    const staticImageUrl = '../asset/notice-free-vector_734448-5.avif';

    div.innerHTML = `
        <img src="${staticImageUrl}" alt="Notice Image" class="notice-img">
        <div class="notice-content">
            <h3>${notice.title || 'No Title'}</h3>
            <div class="notice-field"><strong>Keywords:</strong> ${notice.keyword || 'N/A'}</div>
            <div class="notice-field"><strong>Department:</strong> ${notice.deptName || 'N/A'}</div>
            <div class="notice-field"><strong>Uploaded By:</strong> ${notice.uploadedByName || 'N/A'}</div>
            <div class="notice-field"><strong>Valid Till:</strong> ${validTill}</div>
            <div class="notice-field"><strong>Created At:</strong> ${createdAt}</div>
            <div class="notice-field description"><strong>Description:</strong> ${notice.description || 'N/A'}</div>
            ${notice.fileUrl ? `<div class="notice-field"><a href="${notice.fileUrl}" target="_blank" class="download-link">Download File</a></div>` : ''}
        </div>
    `;
    return div;
}

// ================= SEARCH =================

function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    // Search on Enter key
    input.addEventListener('keyup', async e => {
        if (e.key === 'Enter') {
            await performSearch(input.value);
        }
    });

    // Search on button click
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            await performSearch(input.value);
        });
    }
}

async function performSearch(term) {
    const keyword = term.trim();

    // if empty, reset to all notices
    if (!keyword) {
        try {
            notices = await fetchNotices();
            filteredNotices = [...notices];
            currentPage = 1;
            displayNotices();
        } catch (err) {
            showNotification('Failed to load notices', 'error');
        }
        return;
    }

    try {
        const results = await searchNoticesBackend(keyword);
        filteredNotices = results;
        currentPage = 1;
        displayNotices();

        showNotification(`Search results for "${keyword}"`, 'success');
    } catch (err) {
        console.error("Search failed:", err);
        showNotification('Search failed', 'error');
    }
}

// ================= FILTERS =================
function initFilters() {
    const applyBtn = document.getElementById('applyDateFilter');
    const fromDate = document.getElementById('fromDate');
    const toDate = document.getElementById('toDate');

    if (applyBtn && fromDate && toDate) {
        applyBtn.addEventListener('click', () => {
            const from = fromDate.value;
            const to = toDate.value;
            filterByDateRange(from, to);
        });
    }

    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (fromDate) fromDate.value = '';
            if (toDate) toDate.value = '';
            filteredNotices = [...notices];
            currentPage = 1;
            displayNotices();
        });
    }
}

/*function filterByDateRange(from, to) {
    if (!from || !to) {
        showNotification('Please select both from and to dates', 'error');
        return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (fromDate > toDate) {
        showNotification('From date cannot be after to date', 'error');
        return;
    }

    filteredNotices = notices.filter(n => {
        if (!n.createdAt) return false;
        const noticeDate = new Date(n.createdAt);
        return noticeDate >= fromDate && noticeDate <= toDate;
    });
    
    currentPage = 1;
    displayNotices();
}
*/

// ================= HEADER BUTTONS =================
function initHeaderButtons() {
    // Home button - goes to main.html
    const mainPageBtn = document.getElementById('mainPageBtn');
    if (mainPageBtn) {
        mainPageBtn.addEventListener('click', () => {
            // Add click animation
            mainPageBtn.classList.add('active');
            
            // Check if we're already on main page
            const currentPage = location.pathname.split('/').pop();
            if (currentPage === 'main.html') {
                showNotification('You are already on the main page', 'info');
                setTimeout(() => {
                    mainPageBtn.classList.remove('active');
                }, 500);
                return;
            }
            
            // Check if user is logged in
            if (!currentUser) {
                showNotification('Please login first', 'error');
                setTimeout(() => {
                    mainPageBtn.classList.remove('active');
                }, 500);
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
                return;
            }
            
            // Show loading state
            const originalHTML = mainPageBtn.innerHTML;
            mainPageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            mainPageBtn.disabled = true;
            
            // Navigate to main page
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 300);
        });
    }
    
    // Help button - goes to help.html
    const helpButton = document.getElementById('helpButton');
    if (helpButton) {
        helpButton.addEventListener('click', () => {
            // Add click animation
            helpButton.classList.add('active');
            
            // Check if we're already on help page
            const currentPage = location.pathname.split('/').pop();
            if (currentPage === 'help.html') {
                showNotification('You are already on the help page', 'info');
                setTimeout(() => {
                    helpButton.classList.remove('active');
                }, 500);
                return;
            }
            
            // Show loading state
            const originalHTML = helpButton.innerHTML;
            helpButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            helpButton.disabled = true;
            
            // Navigate to help page
            setTimeout(() => {
                window.location.href = 'help.html';
            }, 300);
        });
    }
}
// ================= PAGINATION =================
function initPagination() {
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (prevPage) {
        prevPage.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                displayNotices();
                updatePagination(); // Update button states
            }
        };
    }

    if (nextPage) {
        nextPage.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayNotices();
                updatePagination(); // Update button states
            }
        };
    }
}

function updatePagination() {
    const paginationInfo = document.getElementById('paginationInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    
    // Update page info text
    if (paginationInfo) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update button disabled states
    if (prevPage) {
        prevPage.disabled = currentPage <= 1;
    }
    
    if (nextPage) {
        nextPage.disabled = currentPage >= totalPages;
    }
    
    // Also update page numbers display if you have that
    updatePageNumbers();
}

// Optional: Add page number buttons
function updatePageNumbers() {
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
    pageNumbers.innerHTML = '';
    
    // Show max 5 page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // First page button
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'btn btn-outline page-number';
        firstBtn.textContent = '1';
        firstBtn.onclick = () => {
            currentPage = 1;
            displayNotices();
            updatePagination();
        };
        pageNumbers.appendChild(firstBtn);
        
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
    }
    
    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-outline'} page-number`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => {
            currentPage = i;
            displayNotices();
            updatePagination();
        };
        pageNumbers.appendChild(pageBtn);
    }
    
    // Last page button
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'btn btn-outline page-number';
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => {
            currentPage = totalPages;
            displayNotices();
            updatePagination();
        };
        pageNumbers.appendChild(lastBtn);
    }
}

// ================= SIDEBAR =================
function initSidebar() {
    const openFiltersBtn = document.getElementById('openFiltersBtn');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('closeSidebar');

    if (openFiltersBtn && sidebar) {
        openFiltersBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }

    if (closeSidebar && sidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    // User panel
    const userButton = document.getElementById('userButton');
    const userPanel = document.getElementById('userPanel');
    const closeUserPanel = document.getElementById('closeUserPanel');

    if (userButton && userPanel) {
        userButton.addEventListener('click', () => {
            userPanel.classList.add('active');
        });
    }

    if (closeUserPanel && userPanel) {
        closeUserPanel.addEventListener('click', () => {
            userPanel.classList.remove('active');
        });
    }

    // Teachers Corner button in header
    const teachersCornerHeaderBtn = document.getElementById('teachersCornerHeaderBtn');
    if (teachersCornerHeaderBtn) {
        teachersCornerHeaderBtn.addEventListener('click', () => {
            initTeachersCornerButton();
        });
    }

    // Help button
    const helpButton = document.getElementById('helpButton');
    if (helpButton) {
        helpButton.addEventListener('click', () => {
            location.href = 'help.html';
        });
    }
}

// ================= TEACHERS CORNER =================
function initTeachersCornerButton() {
    const teachersBtn = document.getElementById('teachersCornerBtn');
    const teachersHeaderBtn = document.getElementById('teachersCornerHeaderBtn');

    const handleClick = () => {
        if (!currentUser) {
            showNotification('Please login first', 'error');
            return;
        }

        // ✅ Set a flag in sessionStorage to indicate we're coming from main.html
        sessionStorage.setItem('fromMainPage', 'true');
        
        // ✅ Navigate to teachers-corner.html
        window.location.href = "teachers-corner.html";
    };

    if (teachersBtn) {
        teachersBtn.addEventListener('click', handleClick);
    }

    if (teachersHeaderBtn) {
        teachersHeaderBtn.addEventListener('click', handleClick);
    }
}
// ================= TEACHERS CORNER =================
async function initTeachersCorner() {
    if (!currentUser) {
        redirectLogin();
        return;
    }


    initHeaderButtons();

    // Check if we're coming from main.html (navigation) or just refreshing
    const cameFromMain = sessionStorage.getItem('fromMainPage') === 'true';
    
    // Clear the flag so it doesn't persist
    sessionStorage.removeItem('fromMainPage');

    // Only show verification modal if we came from main.html (navigation)
    if (cameFromMain) {
        const verifyModal = document.getElementById('verifyModal');
        if (verifyModal) {
            verifyModal.style.display = "flex";

            const closeBtn = document.getElementById('closeVerifyModal');
            const cancelBtn = document.getElementById('cancelVerifyBtn');
            const submitBtn = document.getElementById('submitVerifyBtn');
            const emailInput = document.getElementById('verifyEmail');
            const passwordInput = document.getElementById('verifyPassword');

            const closeModal = () => {
                verifyModal.style.display = "none";
                // If user cancels, redirect back to main
                window.location.href = "main.html";
            };

            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

            if (submitBtn && emailInput && passwordInput) {
                submitBtn.addEventListener('click', async () => {
                    const email = emailInput.value.trim();
                    const password = passwordInput.value.trim();

                    if (!email || !password) {
                        showNotification("Both email and password are required!", "error");
                        return;
                    }

                    try {
                        const verified = await verifyTeacher(email, password);
                        if (verified) {
                            verifyModal.style.display = "none";
                            showNotification("Access granted! Welcome to Teachers Corner.", "success");
                            
                            // Initialize Teachers Corner content
                            initTabs();
                            await initUploadNoticeForm();
                            initUploadFormListener();
                            await initUpdateAdminForm();
                            initUpdatePasswordForm();
                            initUpdateStudentPasswordForm();
                            await initUpdateStudentEmailForm(); 
                            initListStudentsByDepartment();
                            initUpdateDepartmentForm();
                            initAddDepartmentForm();
                            initDeleteDepartmentForm();
                            initDepartmentList();
                            initNoticeManagement();
                            initDeleteNotice();
                             initDepartmentReportDownload();
                             initNoticeReportDownload();    // ✅ For Notice Management ta
                             initQueryReportDownload();  
                             initNoticeReportDownload();

                        } else {
                            showNotification("Unauthorized! You are not privileged to access this page.", "error");
                        }
                    } catch (err) {
                        showNotification(`Verification failed: ${err.message}`, "error");
                    }
                });
            }
            return; // Don't initialize content until verified
        }
    }
    
    // If we're here, either we didn't come from main or verification is already done
    // Initialize content directly
    initTabs();
    await initUploadNoticeForm();
    initUploadFormListener();
    await initUpdateAdminForm();
    initUpdatePasswordForm();
    initUpdateStudentPasswordForm();
    await initUpdateStudentEmailForm(); 
    initListStudentsByDepartment();
    initUpdateDepartmentForm();
    initAddDepartmentForm();
    initDeleteDepartmentForm();
    initDepartmentList();
    initNoticeManagement();
    initDeleteNotice();
     initDepartmentReportDownload();
     initNoticeReportDownload();    // ✅ For Notice Management tab
    initQueryReportDownload();  
}
// ================= UPLOAD NOTICE FORM =================
async function initUploadNoticeForm() {
    const deptSelect = document.getElementById("deptSelect");
    const deptIdInput = document.getElementById("deptId");
    const deptNameInput = document.getElementById("deptName");

    const uploaderSelect = document.getElementById("uploaderSelect");
    const uploaderIdInput = document.getElementById("uploaderId");
    const uploadedByNameInput = document.getElementById("uploadedByName");

    if (
        !deptSelect || !deptIdInput || !deptNameInput ||
        !uploaderSelect || !uploaderIdInput || !uploadedByNameInput
    ) return;

    try {
        // 🔹 Load Departments
        const departments = await getActiveDepartmentNames();
        deptSelect.innerHTML = '<option value="">Select Department</option>';

        departments.forEach(d => {
            const option = document.createElement("option");
            option.value = d.id;          // ID
            option.textContent = d.name;  // Name
            deptSelect.appendChild(option);
        });

        deptSelect.addEventListener("change", () => {
            const opt = deptSelect.selectedOptions[0];
            deptIdInput.value = opt.value;
            deptNameInput.value = opt.textContent;
        });

        // 🔹 Load Admin Teachers
        const admins = await getAdminTeachers();
        uploaderSelect.innerHTML = '<option value="">Select Uploader</option>';

        admins.forEach(a => {
            const option = document.createElement("option");
            option.value = a.id;          // ID
            option.textContent = a.name;  // Name
            uploaderSelect.appendChild(option);
        });

        uploaderSelect.addEventListener("change", () => {
            const opt = uploaderSelect.selectedOptions[0];
            uploaderIdInput.value = opt.value;
            uploadedByNameInput.value = opt.textContent;
        });

    } catch (err) {
        console.error("Failed to initialize upload form:", err);
        showNotification("Failed to load departments or uploaders", "error");
    }
}


// ================= UPLOAD FORM LISTENER =================
function initUploadFormListener() {
    const uploadForm = document.getElementById('uploadForm');
    if (!uploadForm) return;

    uploadForm.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(uploadForm);

        try {
            const success = await uploadNotice(formData);
            if (success) {
                showNotification('Notice uploaded successfully!', 'success');
                uploadForm.reset();
            }
        } catch (err) {
            showNotification(`Failed to upload notice: ${err.message}`, 'error');
        }
    });
}


function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .tab-content').forEach(e => {
                e.classList.remove('active');
            });
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            if (tabId) {
                const content = document.getElementById(tabId);
                if (content) content.classList.add('active');
            }
        });
    });
}

// ================= HELP =================
// ================= HELP =================
function initHelpPage() {
    const form = document.getElementById('helpForm');
    if (!form) return;

    // Character count
    const descriptionInput = document.getElementById('helpDescription');
    const charCount = document.getElementById('charCount');
    
    if (descriptionInput && charCount) {
        descriptionInput.addEventListener('input', () => {
            charCount.textContent = descriptionInput.value.length;
        });
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        
        const title = document.getElementById('helpTitle')?.value.trim();
        const email = document.getElementById('helpEmail')?.value.trim();
        const description = document.getElementById('helpDescription')?.value.trim();

        if (!title || !email || !description) {
            showNotification('All fields are required', 'error');
            return;
        }

        try {
            // Call the actual API function
            await submitHelpQuery(title, description, email);
            showNotification('Help query submitted successfully!', 'success');
            form.reset();
            if (charCount) charCount.textContent = '0';
        } catch (err) {
            console.error('Submit query error:', err);
            showNotification(`Failed to submit help query: ${err.message}`, 'error');
        }
    });
}

async function initDepartmentFilter() {
    const container = document.getElementById("departmentFilter");
    if (!container) return;

    container.innerHTML = ""; // clear loading text

    const select = document.createElement("select");
    select.id = "deptDropdown";
    select.className = "filter-select";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Department";
    select.appendChild(defaultOption);

    try {
        const departments = await getActiveDepartmentNames();

        departments.forEach(dept => {
            const option = document.createElement("option");
            option.value = dept.id;       // 👈 ID stored here
            option.textContent = dept.name; // 👈 Name shown
            select.appendChild(option);
        });

    } catch (err) {
        container.innerHTML = "<p class='error'>Failed to load departments</p>";
        return;
    }

    // Store selected deptId
    select.addEventListener("change", () => {
        selectedDeptId = select.value ? Number(select.value) : null;
    });

    container.appendChild(select);
}
function initDepartmentApplyButton() {
    const applyBtn = document.getElementById("applyDeptFilter");
    const select = document.getElementById("deptDropdown"); // make sure select exists
    if (!applyBtn || !select) return;

    applyBtn.addEventListener("click", async () => {
        const deptId = select.value ? Number(select.value) : null;

        if (!deptId) {
            showNotification("Please select a department", "error");
            return;
        }

        try {
            notices = await fetchNoticesByDepartment(deptId);
            filteredNotices = [...notices];
            currentPage = 1;
            displayNotices();

            showNotification("Department notices loaded", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to load department notices", "error");
        }
    });
}

// ===========================================
// Keyword Filter (from sidebar)
// ===========================================
const applyKeywordFilterBtn = document.getElementById("applyKeywordFilter");
const clearKeywordFilterBtn = document.getElementById("clearKeywordFilter");
const keywordInput = document.getElementById("keywordInput");

if (applyKeywordFilterBtn && keywordInput) {
    applyKeywordFilterBtn.addEventListener("click", async () => {
        const kw = keywordInput.value.trim();
        try {
            if (!kw) {
                showNotification("Please enter a keyword", "error");
                return;
            }
            // call backend search
            notices = await searchNoticesByKeyword(kw);
            filteredNotices = [...notices];
            currentPage = 1;
            displayNotices();
            showNotification(`Filter applied for keyword: "${kw}"`, "success");
        } catch (err) {
            console.error(err);
            showNotification("Keyword search failed", "error");
        }
    });
}

if (clearKeywordFilterBtn) {
    clearKeywordFilterBtn.addEventListener("click", async () => {
        keywordInput.value = "";
        try {
            // reload all notices
            notices = await fetchNotices();
            filteredNotices = [...notices];
            currentPage = 1;
            displayNotices();
            showNotification("Keyword filter cleared", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to load notices", "error");
        }
    });
}


function initDateRangeFilter() {
    const applyBtn = document.getElementById('applyDateFilter');
    const fromDate = document.getElementById('fromDate');
    const toDate = document.getElementById('toDate');

    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const from = fromDate.value;
            const to = toDate.value;

            if (!from || !to) {
                showNotification('Please select both from and to dates', 'error');
                return;
            }

            if (new Date(from) > new Date(to)) {
                showNotification('From date cannot be after To date', 'error');
                return;
            }

            try {
                // call backend API
                const data = await fetchNoticesByDateRange(from, to);
                filteredNotices = data;
                currentPage = 1;
                displayNotices();
                showNotification(`Showing notices from ${from} to ${to}`, 'success');
            } catch (err) {
                console.error('Date range filter failed:', err);
                showNotification('Failed to apply date filter', 'error');
            }
        });
    }
}

async function initUpdateAdminForm() {
    const adminSelect = document.getElementById("adminUserSelect");
    const isAdminSelect = document.getElementById("isAdmin");
    const form = document.getElementById("updateAdminForm");

    if (!adminSelect || !isAdminSelect || !form) return;

    try {
        // 1️⃣ Populate dropdown with teachers (id + name)
        const teachers = await getAdminTeachers(); // reusing your existing function
        adminSelect.innerHTML = '<option value="">Select a teacher</option>';
        teachers.forEach(t => {
            const option = document.createElement("option");
            option.value = t.id;
            option.textContent = t.name;
            adminSelect.appendChild(option);
        });

        // 2️⃣ Handle form submit
        form.addEventListener("submit", async e => {
            e.preventDefault();

            const teacherId = Number(adminSelect.value);
            const isAdmin = isAdminSelect.value === "true";

            if (!teacherId) {
                showNotification("Please select a teacher", "error");
                return;
            }

            try {
                const updatedTeacher = await updateTeacherAdminStatus(teacherId, isAdmin);
                showNotification(`Admin status updated for ${updatedTeacher.name}`, "success");
            } catch (err) {
                showNotification(`Failed to update admin status: ${err.message}`, "error");
            }
        });

    } catch (err) {
        console.error("initUpdateAdminForm error:", err);
        showNotification("Failed to load teachers", "error");
    }
}


// ================= STUDENT PASSWORD =================
function initUpdatePasswordForm() {
    const searchInput = document.getElementById("studentSearch");
    const select = document.getElementById("studentSelect");
    const form = document.getElementById("updatePasswordForm");
    const newPasswordInput = document.getElementById("newPassword");

    if (!searchInput || !select || !form) return;

    let timer;
    searchInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();
            const students = await searchStudents(term);
            populateStudentDropdown(select, students);
        }, 300); // debounce
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const studentId = select.value;
        const newPassword = newPasswordInput.value.trim();

        if (!studentId || !newPassword) {
            showNotification("Please select a student and enter a new password", "error");
            return;
        }

        try {
            await updateStudentPassword(studentId, newPassword);
            showNotification("Password updated successfully!", "success");
        
            form.reset();
            select.innerHTML = '<option value="">Select a student</option>';
        } catch (err) {
            showNotification(`Failed to update password: ${err.message}`, "error");
        }
    });
}

// ================= HELPER =================
function populateStudentDropdown(dropdown, students) {
    dropdown.innerHTML = '<option value="">Select a student</option>';
    students.forEach(s => {
        const option = document.createElement("option");
        option.value = s.id;
        option.textContent = `${s.name} (${s.uid}) - ${s.deptName}`;
        dropdown.appendChild(option);
    });
}

async function initUpdateStudentPasswordForm() {
    const searchInput = document.getElementById("studentSearch");
    const select = document.getElementById("studentSelect");
    const form = document.getElementById("updatePasswordForm");
    const newPasswordInput = document.getElementById("newPassword");

    if (!searchInput || !select || !form || !newPasswordInput) return;

    let students = [];

    // 🔹 Search students on typing
    searchInput.addEventListener("input", async () => {
        const term = searchInput.value.trim();
        if (!term) {
            select.innerHTML = `<option value="">Select a student</option>`;
            return;
        }

        try {
            students = await searchStudents(term); // reuse your existing API
            select.innerHTML = `<option value="">Select a student</option>`;
            students.forEach(s => {
                const option = document.createElement("option");
                option.value = s.id;
                option.textContent = `${s.name} (${s.uid}) - ${s.deptName}`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error("Failed to search students:", err);
        }
    });

    // 🔹 Submit new password
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const studentId = select.value;
        const newPassword = newPasswordInput.value.trim();

        if (!studentId) return showNotification("Please select a student", "error");
        if (!newPassword) return showNotification("Please enter a new password", "error");

        try {
            const updated = await updateStudentPassword(studentId, newPassword);
            showNotification(`Password updated for ${updated.name}`, "success");
            showPasswordPopup(updated.name, newPassword);
            form.reset();
            select.innerHTML = `<option value="">Select a student</option>`;
        } catch (err) {
            showNotification(`Failed to update password: ${err.message}`, "error");
        }
    });
}
function showPasswordPopup(studentName, newPassword) {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    // Create popup box
    const popup = document.createElement("div");
    popup.className = "popup-box";
    popup.innerHTML = `
        <h3>Password Updated</h3>
        <p>The new password for <strong>${studentName}</strong> is:</p>
        <p class="password-display">${newPassword}</p>
        <button id="closePopupBtn" class="btn btn-primary">Close</button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close button
    document.getElementById("closePopupBtn").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });
}

// ================= STUDENT EMAIL UPDATE =================
const emailForm = document.getElementById("updateEmailForm");
const emailSelect = document.getElementById("studentSelectEmail");
const newEmailInput = document.getElementById("newEmail");

if (emailForm) {
    emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const studentId = emailSelect.value;
        const newEmail = newEmailInput.value.trim();

        if (!studentId) return showNotification("Please select a student", "error");
        if (!newEmail) return showNotification("Please enter a new email", "error");

        try {
            const updated = await updateStudentEmail(studentId, newEmail);

            showNotification(`Email updated for ${updated.name}`, "success");

            // 🔹 Show popup with new email
            showStudentPopup(updated.name, "email", newEmail);

            emailForm.reset();
            emailSelect.innerHTML = `<option value="">Select a student</option>`;
        } catch (err) {
            showNotification(`Failed to update email: ${err.message}`, "error");
        }
    });
}
async function initUpdateStudentEmailForm() {
    const searchInput = document.getElementById("studentSearchEmail");
    const select = document.getElementById("studentSelectEmail");
    const form = document.getElementById("updateEmailForm");
    const newEmailInput = document.getElementById("newEmail");

    if (!searchInput || !select || !form || !newEmailInput) return;

    let students = [];

    // 🔹 Search students on typing
    searchInput.addEventListener("input", async () => {
        const term = searchInput.value.trim();
        if (!term) {
            select.innerHTML = `<option value="">Select a student</option>`;
            return;
        }

        try {
            students = await searchStudents(term);
            select.innerHTML = `<option value="">Select a student</option>`;
            students.forEach(s => {
                const option = document.createElement("option");
                option.value = s.id;
                option.textContent = `${s.name} (${s.uid}) - ${s.deptName}`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error("Failed to search students:", err);
        }
    });

    // 🔹 Submit new email
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const studentId = select.value;
        const newEmail = newEmailInput.value.trim();

        if (!studentId) return showNotification("Please select a student", "error");
        if (!newEmail) return showNotification("Please enter a new email", "error");

        try {
            const updated = await updateStudentEmail(studentId, newEmail);
            showNotification(`Email updated for ${updated.name}`, "success");
            showStudentPopup(updated.name, "email", newEmail);

            form.reset();
            select.innerHTML = `<option value="">Select a student</option>`;
        } catch (err) {
            showNotification(`Failed to update email: ${err.message}`, "error");
        }
    });
}
function showStudentPopup(studentName, type, value) {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const popup = document.createElement("div");
    popup.className = "popup-box";
    popup.innerHTML = `
        <h3>${type === 'email' ? 'Email Updated' : 'Password Updated'}</h3>
        <p>The new ${type} for <strong>${studentName}</strong> is:</p>
        <p class="password-display">${value}</p>
        <button class="closePopupBtn btn btn-primary">Close</button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // ✅ Select the button **inside this popup only**
    const closeBtn = popup.querySelector(".closePopupBtn");
    closeBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
    });
}
async function initListStudentsByDepartment() {
    const deptSelect = document.getElementById("deptSelectStudents");
    const form = document.getElementById("listStudentsForm");
    const studentListContainer = document.getElementById("studentList");

    if (!deptSelect || !form || !studentListContainer) return;

    // 1️⃣ Populate departments dropdown
    try {
        const departments = await getActiveDepartmentNames(); // existing API
        deptSelect.innerHTML = '<option value="">Select department</option>';
        departments.forEach(d => {
            const option = document.createElement("option");
            option.value = d.id;
            option.textContent = d.name;
            deptSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to load departments:", err);
        showNotification("Failed to load departments", "error");
        return;
    }

    // 2️⃣ Handle form submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const deptId = deptSelect.value;
        if (!deptId) return showNotification("Please select a department", "error");

        try {
            const students = await getStudentsByDepartment(deptId);
            studentListContainer.innerHTML = ""; // clear previous

            if (!students.length) {
                studentListContainer.innerHTML = "<p>No students found in this department.</p>";
                return;
            }

            const ul = document.createElement("ul");
            ul.className = "student-ul";
            students.forEach(s => {
                const li = document.createElement("li");
                li.textContent = `${s.name} (UID: ${s.uid}) - ${s.deptName}`;
                ul.appendChild(li);
            });

            studentListContainer.appendChild(ul);
            showNotification(`${students.length} student(s) found`, "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to list students", "error");
        }
    });
}
async function initUpdateDepartmentForm() {
    const deptSelect = document.getElementById("deptSelectUpdate");
    const newNameInput = document.getElementById("newDeptName");
    const form = document.getElementById("updateDeptForm");

    if (!deptSelect || !newNameInput || !form) return;

    // 1️⃣ Populate departments dropdown
    try {
        const departments = await getActiveDepartmentNames();
        deptSelect.innerHTML = '<option value="">Select department</option>';
        departments.forEach(d => {
            const option = document.createElement("option");
            option.value = d.id;
            option.textContent = d.name;
            deptSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to load departments:", err);
        showNotification("Failed to load departments", "error");
        return;
    }

    // 2️⃣ Handle form submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const deptId = deptSelect.value;
        const newName = newNameInput.value.trim();

        if (!deptId) return showNotification("Please select a department", "error");
        if (!newName) return showNotification("Please enter the new department name", "error");

        try {
            const updatedDept = await updateDepartmentName(deptId, newName);
            showNotification(`Department updated: ${updatedDept.name}`, "success");

            // Update dropdown text to reflect new name
            deptSelect.querySelector(`option[value="${deptId}"]`).textContent = updatedDept.name;
            form.reset();
        } catch (err) {
            showNotification(`Failed to update department: ${err.message}`, "error");
        }
    });
}

// ================= ADD DEPARTMENT FORM =================
function initAddDepartmentForm() {
    const form = document.getElementById("addDeptForm");
    const input = document.getElementById("newDeptInput");

    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const deptName = input.value.trim();
        if (!deptName) return showNotification("Please enter a department name", "error");

        try {
            const newDept = await addDepartment(deptName);
            showNotification(`Department "${newDept.name}" added successfully!`, "success");

            // Reset form
            input.value = "";

            // Optional: refresh department dropdowns if you have any
            await refreshDepartmentDropdowns();
        } catch (err) {
            showNotification(`Failed to add department: ${err.message}`, "error");
        }
    });
}

// Helper: refresh all department dropdowns after adding new one
async function refreshDepartmentDropdowns() {
    const deptSelects = document.querySelectorAll("select"); // or only your department selects
    try {
        const departments = await getActiveDepartmentNames();

        deptSelects.forEach(select => {
            if (!select.id.includes("dept")) return; // skip unrelated selects
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select department</option>';
            departments.forEach(d => {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = d.name;
                select.appendChild(option);
            });
            select.value = currentVal; // preserve selection if any
        });
    } catch (err) {
        console.error("Failed to refresh departments:", err);
    }
}


// ================= DELETE DEPARTMENT FORM =================
async function initDeleteDepartmentForm() {
    const form = document.getElementById("deleteDeptForm");
    const select = document.getElementById("deptSelectDelete");

    if (!form || !select) return;

    // 🔹 Populate dropdown with active departments
    async function loadDepartments() {
        try {
            const departments = await getActiveDepartmentNames();
            select.innerHTML = '<option value="">Select department</option>';
            departments.forEach(d => {
                const option = document.createElement("option");
                option.value = d.id;     // department ID
                option.textContent = d.name; // department name
                select.appendChild(option);
            });
        } catch (err) {
            console.error("Failed to load departments:", err);
            showNotification("Failed to load departments", "error");
        }
    }

    await loadDepartments();

    // 🔹 Handle form submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const deptId = select.value;

        if (!deptId) {
            showNotification("Please select a department to delete", "error");
            return;
        }

        try {
            const deletedDept = await deleteDepartment(deptId);
            showNotification(`Department "${deletedDept.name}" deleted successfully!`, "success");

            // Reload the department dropdown
            await loadDepartments();
        } catch (err) {
            showNotification(`Failed to delete department: ${err.message}`, "error");
        }
    });
}
// ================= LIST ALL DEPARTMENTS =================
async function initDepartmentList() {
    const container = document.getElementById("deptList");
    if (!container) return;

    container.innerHTML = "<p>Loading departments...</p>";

    try {
        const departments = await getActiveDepartmentNames();

        if (!departments.length) {
            container.innerHTML = "<p>No departments found</p>";
            return;
        }

        const ul = document.createElement("ul");
        ul.className = "department-ul";

        departments.forEach(dept => {
            const li = document.createElement("li");
            li.textContent = dept.name; // show department name
            ul.appendChild(li);
        });

        container.innerHTML = ""; // clear loading
        container.appendChild(ul);

    } catch (err) {
        console.error("Failed to load departments:", err);
        container.innerHTML = "<p class='error'>Failed to load departments</p>";
        showNotification("Failed to load departments", "error");
    }
}

// ================= NOTICE MANAGEMENT =================
async function initNoticeManagement() {
    const container = document.getElementById("noticeList");
    const searchInput = document.getElementById("noticeSearch");
    const searchBtn = document.getElementById("searchNoticesBtn");

    if (!container || !searchInput || !searchBtn) return;

    let allNotices = [];

    // Load all notices initially
    async function loadAllNotices() {
        container.innerHTML = "<p>Loading notices...</p>";
        try {
            allNotices = await fetchNotices(); // existing API
            renderNoticesTable(allNotices);
        } catch (err) {
            console.error("Failed to fetch notices:", err);
            container.innerHTML = "<p class='error'>Failed to load notices</p>";
            showNotification("Failed to load notices", "error");
        }
    }

    // Render notices in a table
    function renderNoticesTable(notices) {
    if (!notices.length) {
        container.innerHTML = "<p class='no-data'>No notices found</p>";
        return;
    }

    // wrap table in scrollable container
    const wrapper = document.createElement("div");
    wrapper.className = "notice-list-container";

    const table = document.createElement("table");
    table.className = "notices-table";

    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Uploaded By</th>
                <th>Keywords</th>
                <th>Valid Till</th>
                <th>Created At</th>
                <th>File</th>
            </tr>
        </thead>
    `;

    const tbody = document.createElement("tbody");

    notices.forEach(n => {
        const validTill = n.validTill ? new Date(n.validTill).toLocaleDateString() : "N/A";
        const createdAt = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "N/A";

        const fileLink = n.fileUrl 
            ? `<a href="${n.fileUrl}" target="_blank">View File</a>` 
            : "N/A";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${n.id}</td>
            <td>${n.title || "No Title"}</td>
            <td>${n.uploadedByName || "N/A"}</td>
            <td>${n.keyword || "N/A"}</td>
            <td>${validTill}</td>
            <td>${createdAt}</td>
            <td>${fileLink}</td>
        `;

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.innerHTML = "";
    container.appendChild(wrapper);
}

    // Search notices
    async function searchNotices() {
        const term = searchInput.value.trim();
        if (!term) {
            renderNoticesTable(allNotices); // show all if search empty
            return;
        }

        try {
            const results = await searchNoticesBackend(term); // backend search API
            renderNoticesTable(results);
            showNotification(`Search results for "${term}"`, "success");
        } catch (err) {
            console.error("Search failed:", err);
            showNotification("Failed to search notices", "error");
        }
    }

    searchBtn.addEventListener("click", searchNotices);
    searchInput.addEventListener("keyup", e => {
        if (e.key === "Enter") searchNotices();
    });

    // Load notices on init
    loadAllNotices();
}


function initDeleteNotice() {
    const deleteBtn = document.getElementById("deleteNoticeBtn");
    const input = document.getElementById("deleteNoticeId");

    if (!deleteBtn || !input) {
        console.error("Delete Notice elements not found");
        return;
    }

    deleteBtn.addEventListener("click", async () => {
        const noticeId = input.value.trim();

        if (!noticeId) {
            alert("Please enter Notice ID");
            return;
        }

        if (!confirm(`Delete notice ID ${noticeId}?`)) return;

        try {
            await deleteNoticeById(noticeId);
            showNotification("Notice deleted successfully", "success");
            input.value = "";
            initNoticeManagement(); // reload notices
        } catch (err) {
            console.error(err);
            showNotification(err.message, "error");
        }
    });
}










// Add to your existing JavaScript

// Queries Management
let allQueries = [];
let currentQueryFilter = 'all';

// DOM Elements
const queriesTab = document.getElementById('queries-management');
const queryFilter = document.getElementById('queryFilter');
const refreshQueriesBtn = document.getElementById('refreshQueriesBtn');
const queriesList = document.getElementById('queriesList');
const queryDetailsModal = document.getElementById('queryDetailsModal');
const closeQueryModal = document.getElementById('closeQueryModal');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');
const toggleResolveBtn = document.getElementById('toggleResolveBtn');

// Event Listeners for Queries Tab
if (queriesTab) {
  document.addEventListener('DOMContentLoaded', () => {
    // Load queries when tab is active
    const queriesTabButton = document.querySelector('[data-tab="queries-management"]');
    queriesTabButton.addEventListener('click', () => {
      loadQueries();
    });
  });
}

if (queryFilter) {
  queryFilter.addEventListener('change', (e) => {
    currentQueryFilter = e.target.value;
    displayQueries();
  });
}

if (refreshQueriesBtn) {
  refreshQueriesBtn.addEventListener('click', loadQueries);
}

if (closeQueryModal) {
  closeQueryModal.addEventListener('click', () => {
    queryDetailsModal.style.display = 'none';
  });
}

if (closeDetailsBtn) {
  closeDetailsBtn.addEventListener('click', () => {
    queryDetailsModal.style.display = 'none';
  });
}

if (toggleResolveBtn) {
  toggleResolveBtn.addEventListener('click', toggleQueryResolveStatus);
}

// Function to load all queries
async function loadQueries() {
  try {
    showLoading(queriesList);
    
    const response = await fetch(`${API_BASE_URL}/queries`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load queries');
    }
    
    allQueries = await response.json();
    
    // Sort by latest first (created_at descending)
    allQueries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    displayQueries();
    
  } catch (error) {
    console.error('Error loading queries:', error);
    queriesList.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load queries. Please try again.</p>
      </div>
    `;
  }
}

// Function to display filtered queries
function displayQueries() {
  if (!allQueries.length) {
    queriesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>No queries found</p>
      </div>
    `;
    return;
  }
  
  let filteredQueries = allQueries;
  
  if (currentQueryFilter === 'resolved') {
    filteredQueries = allQueries.filter(query => query.is_resolved);
  } else if (currentQueryFilter === 'unresolved') {
    filteredQueries = allQueries.filter(query => !query.is_resolved);
  }
  
  if (!filteredQueries.length) {
    queriesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>No queries match the selected filter</p>
      </div>
    `;
    return;
  }
  
  queriesList.innerHTML = filteredQueries.map(query => `
    <div class="query-item" data-query-id="${query.id}">
      <div class="query-header">
        <div class="query-id">Query #${query.id}</div>
        <span class="status-badge ${query.is_resolved ? 'status-resolved' : 'status-unresolved'}">
          ${query.is_resolved ? 'Resolved' : 'Unresolved'}
        </span>
      </div>
      <div class="query-title">${escapeHtml(query.title)}</div>
      <div class="query-meta">
        <span class="query-email">
          <i class="fas fa-envelope"></i> ${escapeHtml(query.sender_email)}
        </span>
        <span class="query-date">
          <i class="fas fa-calendar"></i> ${formatDate(query.created_at)}
        </span>
      </div>
    </div>
  `).join('');
  
  // Add click event to each query item
  document.querySelectorAll('.query-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const queryId = e.currentTarget.dataset.queryId;
      const query = allQueries.find(q => q.id == queryId);
      if (query) {
        showQueryDetails(query);
      }
    });
  });
}

// Function to show query details in modal
function showQueryDetails(query) {
  // Populate modal with query details
  document.getElementById('detailQueryId').textContent = query.id;
  document.getElementById('detailSenderEmail').textContent = query.sender_email;
  document.getElementById('detailQueryTitle').textContent = query.title;
  document.getElementById('detailQueryDescription').textContent = query.description;
  document.getElementById('detailCreatedAt').textContent = formatDate(query.created_at);
  
  const statusBadge = document.getElementById('detailStatus');
  statusBadge.textContent = query.is_resolved ? 'Resolved' : 'Unresolved';
  statusBadge.className = `status-badge ${query.is_resolved ? 'status-resolved' : 'status-unresolved'}`;
  
  // Show/hide resolved date
  const resolvedAtContainer = document.getElementById('detailResolvedAtContainer');
  const resolvedAtElement = document.getElementById('detailResolvedAt');
  
  if (query.resolved_at) {
    resolvedAtContainer.style.display = 'flex';
    resolvedAtElement.textContent = formatDate(query.resolved_at);
  } else {
    resolvedAtContainer.style.display = 'none';
  }
  
  // Update toggle button text
  const toggleBtn = document.getElementById('toggleResolveBtn');
  if (query.is_resolved) {
    toggleBtn.innerHTML = '<i class="fas fa-times-circle"></i> Mark as Unresolved';
    toggleBtn.className = 'btn btn-warning';
  } else {
    toggleBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Resolved';
    toggleBtn.className = 'btn btn-primary';
  }
  
  // Store current query ID
  toggleBtn.dataset.queryId = query.id;
  
  // Show modal
  queryDetailsModal.style.display = 'flex';
}

// Function to toggle query resolve status
async function toggleQueryResolveStatus() {
  const queryId = toggleResolveBtn.dataset.queryId;
  if (!queryId) return;
  
  const query = allQueries.find(q => q.id == queryId);
  if (!query) return;
  
  const newStatus = !query.is_resolved;
  
  try {
    const response = await fetch(`${API_BASE_URL}/queries/${queryId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_resolved: newStatus })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update query status');
    }
    
    // Update local data
    query.is_resolved = newStatus;
    query.resolved_at = newStatus ? new Date().toISOString() : null;
    
    // Refresh display
    displayQueries();
    
    // Update modal if it's still open
    if (queryDetailsModal.style.display === 'flex') {
      showQueryDetails(query);
    }
    
    showNotification(`Query #${queryId} marked as ${newStatus ? 'resolved' : 'unresolved'}`, 'success');
    
  } catch (error) {
    console.error('Error updating query status:', error);
    showNotification('Failed to update query status', 'error');
  }
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to show loading state
function showLoading(element) {
  element.innerHTML = `
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading...</p>
    </div>
  `;
}



const queryTableBody = document.getElementById("queryTableBody");

const refreshBtn = document.getElementById("refreshQueriesBtn");

// ================== Render Table ==================
async function renderQueries() {
    try {
        let queries = [];
        const filterValue = queryFilter.value;

        if (filterValue === "all") queries = await fetchAllQueries();
        else if (filterValue === "resolved") queries = await fetchResolvedQueries();
        else if (filterValue === "unresolved") queries = await fetchUnresolvedQueries();

        queryTableBody.innerHTML = ""; // clear table

        queries.forEach(q => {
            const tr = document.createElement("tr");
            tr.dataset.id = q.id; // store query ID for modal
            tr.innerHTML = `
                <td>${q.id}</td>
                <td>${q.title}</td>
                <td>${q.description}</td>
                <td>${q.sentByEmail}</td>
                <td>${new Date(q.createdAt).toLocaleString()}</td>
                <td>${q.resolved ? "Resolved" : "Unresolved"}</td>
            `;

            // Add click event to open modal
            tr.addEventListener("click", () => openQueryModal(q.id));

            queryTableBody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        queryTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red">Failed to load queries</td></tr>`;
    }


}

 const resolveQueryIdInput = document.getElementById("resolveQueryId");
  const resolvedByInput = document.getElementById("resolvedBy");
  const resolveQueryBtn = document.getElementById("resolveQueryBtn");
  const resolveMsg = document.getElementById("resolveMsg");


  // ======== REFRESH BUTTON ========
  refreshQueriesBtn.addEventListener("click", loadQueries);

  // ======== FILTER CHANGE ========
  queryFilter.addEventListener("change", loadQueries);

  // ======== INITIAL LOAD ========
  loadQueries();

  // ======== RESOLVE QUERY ========
  async function handleResolveQuery() {
    const id = parseInt(resolveQueryIdInput.value);
    const resolvedBy = resolvedByInput.value.trim();

    if (!id || !resolvedBy) {
      resolveMsg.textContent = "Please enter both Query ID and your name.";
      resolveMsg.style.color = "red";
      return;
    }

    try {
      const result = await resolveQuery(id, resolvedBy);
      resolveMsg.textContent = `Query #${result.id} marked as resolved by ${result.resolvedBy}.`;
      resolveMsg.style.color = "green";

      // Clear inputs
      resolveQueryIdInput.value = "";
      resolvedByInput.value = "";

      // Refresh table
      loadQueries();

    } catch (err) {
      console.error(err);
      resolveMsg.textContent = `Failed to resolve query: ${err.message}`;
      resolveMsg.style.color = "red";
    }
  }

  resolveQueryBtn.addEventListener("click", handleResolveQuery);
// ================== Event Listeners ==================
queryFilter.addEventListener("change", renderQueries);
refreshBtn.addEventListener("click", renderQueries);



// Open modal and fetch query details
async function openQueryModal(queryId) {
    try {
        const query = await getQueryById(queryId); // API call

        modalQueryId.textContent = query.id;
        modalQueryTitle.textContent = query.title;
        modalQueryDescription.textContent = query.description;
        modalQuerySender.textContent = query.sentByEmail;
        modalQueryCreatedAt.textContent = new Date(query.createdAt).toLocaleString();
        modalQueryStatus.textContent = query.resolved ? "Resolved" : "Unresolved";
        modalQueryResolvedBy.textContent = query.resolvedBy || "N/A";

        queryModal.style.display = "block";
    } catch (err) {
        console.error("Failed to load query details", err);
        alert("Failed to load query details");
    }
}

// Close modal
closeModalBtn.onclick = () => {
    queryModal.style.display = "none";
};

// Close modal when clicking outside content
window.onclick = (event) => {
    if (event.target === queryModal) queryModal.style.display = "none";
};


document.addEventListener('DOMContentLoaded', async () => {
    const resolveQueryBtn = document.getElementById('resolveQueryBtn');
    const resolveQueryId = document.getElementById('resolveQueryId');
    const resolvedBySelect = document.getElementById('resolvedBy');
    const resolveMsg = document.getElementById('resolveMsg');

    // 1️⃣ Populate dropdown with admin teachers
    try {
        const teachers = await getAdminTeachers(); // [{id, name}]
        resolvedBySelect.innerHTML = '<option value="">Select Teacher</option>'; // default option
        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.name; // store name for now
            option.textContent = teacher.name;
            resolvedBySelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error fetching admin teachers:', err);
        resolvedBySelect.innerHTML = '<option value="">Failed to load teachers</option>';
    }

    // 2️⃣ Handle query resolve
    resolveQueryBtn.addEventListener('click', async () => {
        const queryId = resolveQueryId.value.trim();
        const resolvedBy = resolvedBySelect.value.trim();

        if (!queryId) {
            resolveMsg.textContent = 'Please enter a Query ID.';
            resolveMsg.style.color = 'red';
            return;
        }
        if (!resolvedBy) {
            resolveMsg.textContent = 'Please select a teacher.';
            resolveMsg.style.color = 'red';
            return;
        }

        try {
            // Use your API helper here instead of manual fetch
            await resolveQueryById(queryId, resolvedBy);

            resolveMsg.textContent = `Query #${queryId} resolved by ${resolvedBy}.`;
            resolveMsg.style.color = 'green';
            resolveQueryId.value = '';
            resolvedBySelect.value = '';
        } catch (err) {
            console.error('Error resolving query:', err);
            resolveMsg.textContent = err.message || 'Failed to resolve query.';
            resolveMsg.style.color = 'red';
        }
    });
});

document.getElementById('downloadReportBtn').addEventListener('click', async () => {
    const idInput = document.getElementById('downloadQueryId');
    const msgDiv = document.getElementById('downloadMsg');
    const id = idInput.value.trim();

    if (!id) {
        msgDiv.textContent = "Please enter a Query ID";
        return;
    }

    msgDiv.textContent = "";

    try {
        await downloadQueryReport(id);
        msgDiv.style.color = 'green';
        msgDiv.textContent = `Query report downloaded successfully.`;
    } catch (err) {
        msgDiv.style.color = 'red';
        msgDiv.textContent = `Failed to download report. Check the ID.`;
    }
});

// ================= DEPARTMENT REPORT DOWNLOAD =================
async function initDepartmentReportDownload() {
    const form = document.getElementById('downloadDeptReportForm');
    const deptSelect = document.getElementById('deptSelectReport');
    const deptIdDisplay = document.getElementById('deptIdDisplay');
    const msgDiv = document.getElementById('reportDownloadMsg');
    
    if (!form || !deptSelect || !deptIdDisplay) {
        console.error('Department report download elements not found');
        return;
    }
    
    // Populate department dropdown
    try {
        const departments = await getActiveDepartmentNames();
        deptSelect.innerHTML = '<option value="">Select department</option>';
        
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = `${dept.name} (ID: ${dept.id})`;
            option.setAttribute('data-name', dept.name);
            deptSelect.appendChild(option);
        });
        
        // Update department ID display when selection changes
        deptSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const deptId = this.value;
            const deptName = selectedOption ? selectedOption.getAttribute('data-name') : '';
            
            deptIdDisplay.value = deptId || '';
        });
        
    } catch (error) {
        console.error('Failed to load departments for report:', error);
        deptSelect.innerHTML = '<option value="">Failed to load departments</option>';
    }
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const deptId = deptSelect.value;
        
        if (!deptId) {
            showNotification('Please select a department', 'error');
            return;
        }
        
        try {
            // Show loading message
            if (msgDiv) {
                msgDiv.textContent = 'Generating PDF report...';
                msgDiv.className = 'form-msg info';
            }
            
            // Generate and download PDF
            await downloadDepartmentReport(deptId);
            
            // Clear form
            deptSelect.value = '';
            deptIdDisplay.value = '';
            
            // Show success message
            if (msgDiv) {
                msgDiv.textContent = 'Report downloaded successfully!';
                msgDiv.className = 'form-msg success';
                
                // Clear message after 3 seconds
                setTimeout(() => {
                    msgDiv.textContent = '';
                    msgDiv.className = 'form-msg';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Failed to download report:', error);
            
            if (msgDiv) {
                msgDiv.textContent = 'Failed to download report. Please try again.';
                msgDiv.className = 'form-msg error';
            }
            
            showNotification('Failed to download report', 'error');
        }
    });
}


// ================= QUERY REPORT DOWNLOAD =================
async function initQueryReportDownload() {
    const form = document.getElementById('generateQueryReportForm');
    const filterSelect = document.getElementById('queryReportFilter');
    const startDateInput = document.getElementById('queryStartDate');
    const endDateInput = document.getElementById('queryEndDate');
    const msgDiv = document.getElementById('queryReportMsg');
    
    if (!form || !filterSelect || !startDateInput || !endDateInput) return;
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const filterType = filterSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        // Validate dates
        if (startDate && endDate) {
            if (new Date(startDate) > new Date(endDate)) {
                showNotification('Start date cannot be after end date', 'error');
                return;
            }
        }
        
        try {
            // Show loading
            if (msgDiv) {
                msgDiv.textContent = 'Generating query report...';
                msgDiv.className = 'form-msg info';
                msgDiv.style.display = 'block';
            }
            
            // Build API URL
            let apiUrl = `http://localhost:8080/api/query-reports/generate?filterType=${filterType}`;
            
            if (startDate) {
                apiUrl += `&startDate=${startDate}`;
            }
            
            if (endDate) {
                apiUrl += `&endDate=${endDate}`;
            }
            
            // Fetch PDF
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Get filename from headers
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'query_report.pdf';
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            
            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // Show success message
            if (msgDiv) {
                msgDiv.textContent = 'Query report downloaded successfully!';
                msgDiv.className = 'form-msg success';
                
                setTimeout(() => {
                    msgDiv.style.display = 'none';
                    msgDiv.textContent = '';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Failed to download query report:', error);
            
            if (msgDiv) {
                msgDiv.textContent = `Error: ${error.message}`;
                msgDiv.className = 'form-msg error';
                msgDiv.style.display = 'block';
            }
        }
    });
    
    // Add date validation
    startDateInput.addEventListener('change', validateDates);
    endDateInput.addEventListener('change', validateDates);
    
    function validateDates() {
        const start = startDateInput.value;
        const end = endDateInput.value;
        
        if (start && end && new Date(start) > new Date(end)) {
            startDateInput.style.borderColor = '#dc3545';
            endDateInput.style.borderColor = '#dc3545';
        } else {
            startDateInput.style.borderColor = '';
            endDateInput.style.borderColor = '';
        }
    }
}

// ================= NOTICE REPORT DOWNLOAD =================
async function initNoticeReportDownload() {
    const form = document.getElementById('downloadNoticeReportForm');
    const deptSelect = document.getElementById('noticeDeptSelect');
    const deptIdDisplay = document.getElementById('noticeDeptIdDisplay');
    const msgDiv = document.getElementById('noticeReportMsg');
    
    if (!form || !deptSelect) return;
    
    // Populate department dropdown
    try {
        const departments = await getActiveDepartmentNames();
        deptSelect.innerHTML = '<option value="">Select department</option>';
        
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = `${dept.name} (ID: ${dept.id})`;
            deptSelect.appendChild(option);
        });
        
        // Update ID display when selection changes
        deptSelect.addEventListener('change', function() {
            deptIdDisplay.value = this.value || '';
        });
        
    } catch (error) {
        console.error('Failed to load departments:', error);
        deptSelect.innerHTML = '<option value="">Failed to load departments</option>';
    }
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const deptId = deptSelect.value;
        
        if (!deptId) {
            showNotification('Please select a department', 'error');
            return;
        }
        
        try {
            // Show loading
            if (msgDiv) {
                msgDiv.textContent = 'Generating department notice report...';
                msgDiv.className = 'form-msg info';
                msgDiv.style.display = 'block';
            }
            
            // Call the NEW API function
            await downloadDepartmentNoticeReport(deptId);
            
            // Clear form
            deptSelect.value = '';
            deptIdDisplay.value = '';
            
            // Show success message
            if (msgDiv) {
                msgDiv.textContent = 'Department notice report downloaded successfully!';
                msgDiv.className = 'form-msg success';
                
                setTimeout(() => {
                    msgDiv.style.display = 'none';
                    msgDiv.textContent = '';
                }, 3000);
            }
            
            showNotification('Notice report downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to download report:', error);
            
            if (msgDiv) {
                msgDiv.textContent = `Error: ${error.message}`;
                msgDiv.className = 'form-msg error';
                msgDiv.style.display = 'block';
            }
            
            showNotification(`Failed to download report: ${error.message}`, 'error');
        }
    });
}  
// ================= GLOBAL EXPORTS =================
window.displayNotices = displayNotices;
window.showNotification = showNotification;
window.searchNotices = searchNotices;