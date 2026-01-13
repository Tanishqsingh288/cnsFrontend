const BASE_URL = "http://localhost:8080/api/cns";
const SHORT_BASE_URL="http://localhost:8080/api"

const studentTableBody = document.querySelector("#studentTable tbody");
const searchInput = document.getElementById("studentSearch");
const searchBtn = document.getElementById("studentSearchBtn");
/**
 * Fetch active departments and return their id and name.
 * @returns {Promise<{id:number, name:string}[]>} Array of departments with id and name
 */
export async function getActiveDepartmentNames() {
    try {
        const response = await fetch(`${BASE_URL}/departments/active`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching departments: ${response.status}`);
        }

        const data = await response.json();

        // Return id and name
        const departments = data.map(dept => ({
            id: dept.id,
            name: dept.name
        }));
        return departments;

    } catch (error) {
        console.error("Failed to fetch active departments:", error);
        return [];
    }
}

/**
 * Register a user
 */
export async function registerUser(data) {
    try {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                password: data.password,
                role: data.role,
                departmentId: Number(data.departmentId) // ensure it's numeric
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Registration failed");
        }

        const resData = await response.json();
        return resData;

    } catch (err) {
        console.error("registerUser error:", err);
        throw err;
    }
}

/**
 * Login a user
 */
export async function loginUser(email, password, role) {
    try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password, role })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Login failed");
        }

        const resData = await response.json();
        return resData;

    } catch (err) {
        console.error("loginUser error:", err);
        throw err;
    }
}
// ================= NOTICES =================
/**
 * Fetch all notices from the server
 * @returns {Promise<Array>} Array of notice objects
 */
export async function fetchNotices() {
    try {
        const response = await fetch(`${BASE_URL}/notices`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
                // remove Authorization temporarily
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch notices: ${response.status}`);
        }

        const data = await response.json();
        console.log("Notices fetched:", data);
        return data;

    } catch (err) {
        console.error("fetchNotices error:", err);
        return [];
    }
}

// ================= AUTH VERIFY =================
/**
 * Verify teacher credentials before allowing access to Teachers Corner
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} true if verified
 */
export async function verifyTeacher(email, password) {
    try {
        const response = await fetch(`${BASE_URL}/auth/verify`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error(`Verification failed: ${response.status}`);
        }

        const result = await response.json(); // should return true/false
        return result === true;

    } catch (err) {
        console.error("verifyTeacher error:", err);
        return false;
    }
}
export async function fetchNoticesByDepartment(deptId) {
    try {
        const response = await fetch(
            `${BASE_URL}/notices/department/${deptId}`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch notices for department ${deptId}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching notices by department:", error);
        return [];
    }
}
export async function searchNoticesByKeyword(keyword) {
  try {
    const url = keyword
      ? `${BASE_URL}/notices/search-by-keyword?keyword=${encodeURIComponent(keyword)}`
      : `${BASE_URL}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Search failed");
    return await res.json();
  } catch (err) {
    console.error("Error searching notices:", err);
    return [];
  }
}
export async function fetchNoticesByDateRange(from, to) {
  try {
    // from/to expected in ISO yyyy-MM-dd format
    const url = `${BASE_URL}/notices/daterange?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch by date range");
    return await res.json();
  } catch (err) {
    console.error("Error fetching date range notices:", err);
    return [];
  }
}
export async function searchNoticesBackend(keyword) {
  try {
    // the API requires a keyword
    const url = `${BASE_URL}/notices/search?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Search request failed");
    return await res.json();
  } catch (err) {
    console.error("Error in searchNoticesBackend:", err);
    return [];
  }
}
/**
 * Fetch all admin teachers (id + name)
 * @returns {Promise<{id:number, name:string}[]>}
 */
export async function getAdminTeachers() {
    try {
        const res = await fetch(`${BASE_URL}/teachers/admins`);
        if (!res.ok) throw new Error("Failed to fetch admins");
        const data = await res.json();
        // Only return id + name for dropdown
        return data.map(t => ({ id: t.id, name: t.name }));
    } catch (err) {
        console.error("getAdminTeachers error:", err);
        return [];
    }
}
// apis.js
export async function uploadNotice(formData) {
    try {
        // Convert the validTill to ISO string for backend
        const validTill = formData.get('validTill');
        if (validTill) {
            const instant = new Date(validTill).toISOString();
            formData.set('validTillAsInstant', instant);
        }

        // Get session value
        const session = formData.get('session');
        if (!session || session.trim() === '') {
            throw new Error('Session is required');
        }

        const response = await fetch(`${BASE_URL}/notices/file/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Upload failed');
        }

        const data = await response.json();

        // Check backend success flag
        if (data.success) {
            return true;
        } else {
            throw new Error(data.message || 'Upload failed');
        }

    } catch (err) {
        console.error('uploadNotice error:', err);
        throw err;
    }
}
/**
 * Update a teacher's admin status
 * @param {number} teacherId - Teacher ID
 * @param {boolean} isAdmin - true to make admin, false to remove
 * @returns {Promise<Object>} Updated teacher object
 */
export async function updateTeacherAdminStatus(teacherId, isAdmin) {
    try {
        const response = await fetch(`${BASE_URL}/teachers/${teacherId}/admin-status?isAdmin=${isAdmin}`, {
            method: "PUT",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to update admin status");
        }

        const data = await response.json();
        return data;

    } catch (err) {
        console.error("updateTeacherAdminStatus error:", err);
        throw err;
    }
}
export async function searchStudents(searchTerm) {
    try {
        const url = new URL(`${BASE_URL}/students`);
        if (searchTerm) url.searchParams.append("search", searchTerm);

        const res = await fetch(url.toString(), {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
        });

        if (!res.ok) throw new Error("Failed to fetch students");

        return await res.json(); // Returns array of students
    } catch (err) {
        console.error("searchStudents error:", err);
        return [];
    }
}
// ================= UPDATE STUDENT PASSWORD =================
export async function updateStudentPassword(studentId, newPassword) {
    if (!studentId || !newPassword) throw new Error("Student ID and new password are required");

    try {
        const res = await fetch(`${BASE_URL}/students/${studentId}/password?password=${encodeURIComponent(newPassword)}`, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to update password");
        }

        const data = await res.json();
        return data;

    } catch (err) {
        console.error("updateStudentPassword error:", err);
        throw err;
    }
}
// ================== STUDENT APIS ==================

export async function updateStudentEmail(id, email) {
    const token = localStorage.getItem("token") || "";
    const res = await fetch(`${BASE_URL}/students/${id}/email?email=${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update email");
    }

    return await res.json();
}


// ================= STUDENTS BY DEPARTMENT =================
export async function getStudentsByDepartment(deptId) {
    try {
        const res = await fetch(`${BASE_URL}/students/department/${deptId}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch students: ${res.statusText}`);
        }

        const data = await res.json();
        return data; // array of students
    } catch (err) {
        console.error("getStudentsByDepartment error:", err);
        throw err;
    }
}
// ================= UPDATE DEPARTMENT NAME =================
export async function updateDepartmentName(deptId, newName) {
    try {
        // Send name as query param
        const res = await fetch(`${BASE_URL}/departments/${deptId}?name=${encodeURIComponent(newName)}`, {
            method: "PUT", // backend uses PUT
            headers: {
                "Accept": "application/json",
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to update department: ${errText}`);
        }

        const updatedDept = await res.json();
        return updatedDept;
    } catch (err) {
        console.error("updateDepartmentName error:", err);
        throw err;
    }
}
// ================= ADD NEW DEPARTMENT =================
export async function addDepartment(deptName) {
    try {
        // Name is sent as query parameter
        const res = await fetch(`${BASE_URL}/departments?name=${encodeURIComponent(deptName)}`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
            },
            body: null // no body needed
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to add department: ${errText}`);
        }

        const newDept = await res.json();
        return newDept; // returns the newly added department object
    } catch (err) {
        console.error("addDepartment error:", err);
        throw err;
    }
}
// ================= DELETE DEPARTMENT =================
export async function deleteDepartment(deptId) {
    try {
        const res = await fetch(`${BASE_URL}/departments/${deptId}`, {
            method: "DELETE",
            headers: {
                "Accept": "application/json",
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to delete department: ${errText}`);
        }

        // Returns the deleted department object (isActive: false)
        const deletedDept = await res.json();
        return deletedDept;
    } catch (err) {
        console.error("deleteDepartment error:", err);
        throw err;
    }
}
// ================= DELETE NOTICE =================
export async function deleteNoticeById(noticeId) {
    try {
        const res = await fetch(`${BASE_URL}/notices/file/${noticeId}`, {
            method: "DELETE",
            headers: {
                "Accept": "application/json",
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to delete notice: ${errText}`);
        }

        const data = await res.json();
        return data.message; // "File deleted successfully"
    } catch (err) {
        console.error("deleteNoticeById error:", err);
        throw err;
    }
}
// ================== apis.js ==================

// Fetch all queries
export async function fetchAllQueries() {
    const res = await fetch(`${SHORT_BASE_URL}/queries`);
    if (!res.ok) throw new Error("Failed to fetch queries");
    return await res.json();
}

// Fetch unresolved queries
export async function fetchUnresolvedQueries() {
    const res = await fetch(`${SHORT_BASE_URL}/queries/unresolved`);
    if (!res.ok) throw new Error("Failed to fetch unresolved queries");
    return await res.json();
}

// Fetch resolved queries
export async function fetchResolvedQueries() {
    const res = await fetch(`${SHORT_BASE_URL}/queries/resolved`);
    if (!res.ok) throw new Error("Failed to fetch resolved queries");
    return await res.json();
}
// **New: Resolve Query**
export async function resolveQuery(id, resolvedBy) {
  const res = await fetch(
    `${SHORT_BASE_URL}/queries/${id}/resolve?resolvedBy=${encodeURIComponent(resolvedBy)}`,
    {
      method: "PUT",
      headers: {
        "Accept": "application/json",
      },
    }
  );
  if (!res.ok) throw new Error("Failed to resolve query");
  return res.json();
}
export async function getQueryById(id) {
  try {
    const res = await fetch(`${SHORT_BASE_URL}/queries/${id}`);
    if (!res.ok) throw new Error("Failed to fetch query");
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * Send a help/support query
 * @param {Object} queryData
 * @param {string} queryData.title
 * @param {string} queryData.description
 * @param {string} queryData.sentByEmail
 */
export async function sendQuery(queryData) {
    try {
        const res = await fetch(`${SHORT_BASE_URL}/queries`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "accept": "*/*"
            },
            body: JSON.stringify(queryData)
        });

        if (!res.ok) {
            throw new Error("Failed to submit query");
        }

        return await res.json();
    } catch (error) {
        console.error("Error sending query:", error);
        throw error;
    }
}
export async function submitHelpQuery(title, description, email) {
    const res = await fetch("http://localhost:8080/api/queries", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title,
            description,
            sentByEmail: email
        })
    });

    if (!res.ok) throw new Error("Failed");

    return res.json();
}
export async function logoutUser() {
    try {
        const response = await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*'
            }
        });

        if (!response.ok) {
            throw new Error('Logout failed');
        }

        return await response.text(); // Returns "Logged out successfully"
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}
// apis.js - Add this to your exports

export async function resetPassword(email, newPassword, confirmPassword) {
    try {
        const response = await fetch(`${BASE_URL}/auth/resetpassword`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*'
            },
            body: JSON.stringify({
                email: email,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            })
        });

        if (!response.ok) {
            throw new Error('Password reset failed');
        }

        return await response.json(); // Returns { "message": "Password reset successful" }
    } catch (error) {
        console.error('Reset password error:', error);
        throw error;
    }
}

/**
 * Download PDF report of a query by ID
 * @param {number} id 
 */
export async function downloadQueryReport(id) {
    try {
        const response = await fetch(`${SHORT_BASE_URL}/pdf/query/${id}`, {
            method: 'GET',
        });

        if (!response.ok) throw new Error("Failed to download report");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `query_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error(error);
        throw error;
    }
}
// Function to download department report PDF
export async function downloadDepartmentReport(deptId) {
    try {
        // Show loading notification
        showNotification('Generating PDF report...', 'info');
        
        // Call the PDF API
        const response = await fetch(`${SHORT_BASE_URL}/pdf/department/${deptId}/report`, {
            method: 'GET',
            headers: {
                'Accept': 'application/pdf'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to generate report: ${response.status} ${response.statusText}`);
        }
        
        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `department_${deptId}_notice_report.pdf`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        
        // Create blob from response
        const blob = await response.blob();
        
        // Create download link and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        window.URL.revokeObjectURL(url);
        
        showNotification('Report downloaded successfully!', 'success');
        return true;
        
    } catch (error) {
        console.error('Error downloading department report:', error);
        showNotification(`Failed to download report: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Download Department Notice Report PDF
 * @param {number} deptId - Department ID
 */
export async function downloadDepartmentNoticeReport(deptId) {
    try {
        // Call the PDF API endpoint
        const response = await fetch(`http://localhost:8080/api/reports/department/${deptId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/pdf'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to generate report: ${response.status} ${response.statusText}`);
        }
        
        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `department_summary_${deptId}.pdf`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        
        // Create blob from response
        const blob = await response.blob();
        
        // Create download link and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        window.URL.revokeObjectURL(url);
        
        return true;
        
    } catch (error) {
        console.error('Error downloading department notice report:', error);
        throw error;
    }
}