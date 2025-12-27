// ==================== CONFIGURATION ====================
const CONFIG = {
    API_URL: 'http://127.0.0.1:5000/api',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    ITEMS_PER_PAGE: 12,
    CACHE_DURATION: 300000 // 5 minutes
};

// ==================== STATE MANAGEMENT ====================
let appState = {
    currentUser: null,
    photos: [],
    currentPage: 1,
    totalPages: 1,
    filters: {
        search: '',
        sort: 'newest',
        location: 'all',
        minRating: 0
    },
    cart: []
};

// ==================== AUTHENTICATION SERVICE ====================
class AuthService {
    static async login(username, password) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success && data.user) {
                // Save user to localStorage
                localStorage.setItem('photoapp_user', JSON.stringify(data.user));
                localStorage.setItem('photoapp_token', 'authenticated');
                appState.currentUser = data.user;
                
                return {
                    success: true,
                    user: data.user,
                    message: 'Login successful'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Invalid credentials'
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
            };
        }
    }

    static async register(userData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: 'Network error during registration'
            };
        }
    }

    static logout() {
        localStorage.removeItem('photoapp_user');
        localStorage.removeItem('photoapp_token');
        appState.currentUser = null;
        window.location.href = 'index.html';
    }

    static getCurrentUser() {
        if (appState.currentUser) {
            return appState.currentUser;
        }
        
        const user = localStorage.getItem('photoapp_user');
        if (user) {
            appState.currentUser = JSON.parse(user);
            return appState.currentUser;
        }
        
        return null;
    }

    static isAuthenticated() {
        return localStorage.getItem('photoapp_token') !== null;
    }

    static isCreator() {
        const user = this.getCurrentUser();
        return user && user.role === 'creator';
    }

    static isConsumer() {
        const user = this.getCurrentUser();
        return user && user.role === 'consumer';
    }
}

// ==================== API SERVICE ====================
class ApiService {
    static async get(endpoint, params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = queryString ? `${CONFIG.API_URL}${endpoint}?${queryString}` : `${CONFIG.API_URL}${endpoint}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`API GET Error (${endpoint}):`, error);
            throw error;
        }
    }

    static async post(endpoint, data) {
        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error(`API POST Error (${endpoint}):`, error);
            throw error;
        }
    }

    static async uploadPhoto(formData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    }
}

// ==================== PHOTO SERVICE ====================
class PhotoService {
    static async getPhotos(page = 1, filters = {}) {
        const params = {
            page: page,
            limit: CONFIG.ITEMS_PER_PAGE,
            ...filters
        };
        return await ApiService.get('/photos', params);
    }

    static async getPhotoById(id) {
        return await ApiService.get(`/photos/${id}`);
    }

    static async uploadPhoto(photoData) {
        const formData = new FormData();
        formData.append('title', photoData.title);
        formData.append('description', photoData.description);
        formData.append('location', photoData.location);
        formData.append('tags', photoData.tags);
        formData.append('people', photoData.people);
        formData.append('privacy', photoData.privacy);
        formData.append('uploader_id', photoData.uploader_id);
        formData.append('photo', photoData.file);

        return await ApiService.uploadPhoto(formData);
    }

    static async searchPhotos(query) {
        return await ApiService.get('/search', { q: query });
    }

    static async addComment(photoId, comment) {
        const user = AuthService.getCurrentUser();
        if (!user) throw new Error('User must be logged in to comment');
        
        return await ApiService.post(`/photos/${photoId}/comments`, {
            user_id: user.id,
            comment: comment
        });
    }

    static async ratePhoto(photoId, rating) {
        const user = AuthService.getCurrentUser();
        if (!user) throw new Error('User must be logged in to rate');
        
        return await ApiService.post(`/photos/${photoId}/rate`, {
            user_id: user.id,
            rating: rating
        });
    }
}

// ==================== UTILITY FUNCTIONS ====================
class Utils {
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static validatePassword(password) {
        return password.length >= 6;
    }
}

// ==================== UI COMPONENTS ====================
class UIComponents {
    static createPhotoCard(photo) {
        return `
            <div class="photo-card" data-id="${photo.id}">
                <div class="photo-image" onclick="PhotoGallery.showPhotoDetail(${photo.id})">
                    <img src="${photo.image_url || 'https://via.placeholder.com/300x200'}" 
                         alt="${photo.title}" 
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/300x200'">
                    <div class="photo-overlay">
                        <button class="btn-favorite" onclick="event.stopPropagation(); toggleFavorite(${photo.id})">
                            <i class="far fa-heart"></i>
                        </button>
                        <button class="btn-share" onclick="event.stopPropagation(); sharePhoto(${photo.id})">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="photo-info">
                    <h3>${photo.title}</h3>
                    <p class="photo-description">${photo.description || 'No description'}</p>
                    <div class="photo-meta">
                        <span class="location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${photo.location || 'Unknown'}
                        </span>
                        <span class="rating">
                            <i class="fas fa-star"></i>
                            ${photo.avg_rating || '0.0'}
                        </span>
                        <span class="comments">
                            <i class="fas fa-comment"></i>
                            ${photo.comment_count || 0}
                        </span>
                    </div>
                    <div class="photo-footer">
                        <small>By: ${photo.uploader_name || 'Anonymous'}</small>
                        <small>${Utils.formatDate(photo.created_at)}</small>
                    </div>
                </div>
            </div>
        `;
    }

    static createComment(comment) {
        return `
            <div class="comment">
                <div class="comment-header">
                    <strong>${comment.username || 'Anonymous'}</strong>
                    <small>${Utils.formatDate(comment.created_at)}</small>
                </div>
                <p>${comment.comment_text}</p>
            </div>
        `;
    }

    static createPagination(currentPage, totalPages) {
        let html = '';
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        // Previous button
        html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                  onclick="PhotoGallery.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                  <i class="fas fa-chevron-left"></i>
                </button>`;

        // Page numbers
        if (start > 1) {
            html += `<button class="page-btn" onclick="PhotoGallery.goToPage(1)">1</button>`;
            if (start > 2) html += `<span class="page-dots">...</span>`;
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                      onclick="PhotoGallery.goToPage(${i})">
                      ${i}
                    </button>`;
        }

        if (end < totalPages) {
            if (end < totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="page-btn" onclick="PhotoGallery.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                  onclick="PhotoGallery.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                  <i class="fas fa-chevron-right"></i>
                </button>`;

        return html;
    }

    static createLoginForm() {
        return `
            <div class="auth-container">
                <div class="auth-header">
                    <i class="fas fa-camera"></i>
                    <h2>PhotoShare Login</h2>
                    <p>Azure Cloud Native Application</p>
                </div>
                
                <form id="loginForm" class="auth-form">
                    <div class="form-group">
                        <label for="loginUsername">
                            <i class="fas fa-user"></i> Username
                        </label>
                        <input type="text" id="loginUsername" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="loginPassword">
                            <i class="fas fa-lock"></i> Password
                        </label>
                        <input type="password" id="loginPassword" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="userRole">
                            <i class="fas fa-user-tag"></i> Login as
                        </label>
                        <select id="userRole">
                            <option value="consumer">Consumer (Browse Photos)</option>
                            <option value="creator">Creator (Upload Photos)</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                </form>
                
                <div class="auth-footer">
                    <p>Don't have an account? <a href="#" onclick="showRegisterForm()">Register here</a></p>
                </div>
            </div>
        `;
    }

    static createRegisterForm() {
        return `
            <div class="auth-container">
                <div class="auth-header">
                    <i class="fas fa-user-plus"></i>
                    <h2>Create Account</h2>
                    <p>Join PhotoShare Platform</p>
                </div>
                
                <form id="registerForm" class="auth-form">
                    <div class="form-group">
                        <label for="regUsername">
                            <i class="fas fa-user"></i> Username *
                        </label>
                        <input type="text" id="regUsername" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="regEmail">
                            <i class="fas fa-envelope"></i> Email *
                        </label>
                        <input type="email" id="regEmail" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="regPassword">
                            <i class="fas fa-lock"></i> Password *
                        </label>
                        <input type="password" id="regPassword" required minlength="6">
                    </div>
                    
                    <div class="form-group">
                        <label for="regRole">
                            <i class="fas fa-user-tag"></i> Account Type *
                        </label>
                        <select id="regRole" required>
                            <option value="">Select role</option>
                            <option value="creator">Creator (Upload photos)</option>
                            <option value="consumer">Consumer (Browse photos)</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-user-plus"></i> Register
                    </button>
                </form>
                
                <div class="auth-footer">
                    <p>Already have an account? <a href="#" onclick="showLoginForm()">Login here</a></p>
                </div>
            </div>
        `;
    }
}

// ==================== PHOTO GALLERY MANAGER ====================
class PhotoGallery {
    static currentPage = 1;
    static totalPages = 1;
    static filters = {
        search: '',
        sort: 'newest',
        location: 'all',
        minRating: 0
    };

    static async loadPhotos() {
        try {
            const response = await PhotoService.getPhotos(this.currentPage, this.filters);
            
            this.photos = response.photos || [];
            this.totalPages = response.pagination?.pages || 1;
            
            this.renderPhotos();
            this.renderPagination();
            
            // Update stats
            if (response.pagination) {
                document.getElementById('totalPhotos')?.textContent = response.pagination.total || 0;
            }
            
            return response;
        } catch (error) {
            console.error('Error loading photos:', error);
            Utils.showNotification('Failed to load photos', 'error');
            throw error;
        }
    }

    static renderPhotos() {
        const container = document.getElementById('galleryGrid');
        if (!container) return;
        
        if (this.photos.length === 0) {
            container.innerHTML = `
                <div class="no-photos">
                    <i class="fas fa-image fa-3x"></i>
                    <h3>No photos found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.photos.map(photo => 
            UIComponents.createPhotoCard(photo)
        ).join('');
    }

    static renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        if (this.totalPages <= 1) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        container.innerHTML = UIComponents.createPagination(this.currentPage, this.totalPages);
    }

    static async showPhotoDetail(photoId) {
        try {
            const photo = await PhotoService.getPhotoById(photoId);
            // Show modal with photo details
            this.showPhotoModal(photo);
        } catch (error) {
            console.error('Error loading photo details:', error);
            Utils.showNotification('Failed to load photo details', 'error');
        }
    }

    static showPhotoModal(photo) {
        // Modal implementation
        console.log('Show photo modal:', photo);
    }

    static searchPhotos() {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            this.filters.search = searchInput.value;
            this.currentPage = 1;
            this.loadPhotos();
        }
    }

    static goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadPhotos();
            window.scrollTo(0, 0);
        }
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('PhotoShare Application Initialized');
    
    // Check authentication
    const user = AuthService.getCurrentUser();
    if (user) {
        appState.currentUser = user;
        updateUIForUser();
    }
    
    // Check current page and initialize accordingly
    const path = window.location.pathname;
    const page = path.split('/').pop();
    
    if (page === 'consumer.html' || page === '') {
        // Initialize gallery
        PhotoGallery.loadPhotos();
    }
    
    // Setup event listeners
    setupEventListeners();
});

function updateUIForUser() {
    const user = appState.currentUser;
    if (!user) return;
    
    // Update navigation based on role
    const creatorLinks = document.querySelectorAll('.creator-only');
    const consumerLinks = document.querySelectorAll('.consumer-only');
    
    if (user.role === 'creator') {
        creatorLinks.forEach(link => link.style.display = 'block');
    } else {
        creatorLinks.forEach(link => link.style.display = 'none');
    }
    
    // Update welcome message
    const welcomeElements = document.querySelectorAll('.welcome-user');
    welcomeElements.forEach(el => {
        if (el) el.textContent = `Welcome, ${user.username}!`;
    });
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const role = document.getElementById('userRole')?.value || 'consumer';
            
            const result = await AuthService.login(username, password);
            
            if (result.success) {
                Utils.showNotification('Login successful!', 'success');
                
                // Redirect based on role
                if (role === 'creator') {
                    window.location.href = 'creator.html';
                } else {
                    window.location.href = 'consumer.html';
                }
            } else {
                Utils.showNotification(result.error, 'error');
            }
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userData = {
                username: document.getElementById('regUsername').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                role: document.getElementById('regRole').value
            };
            
            // Validate
            if (!Utils.validateEmail(userData.email)) {
                Utils.showNotification('Please enter a valid email', 'error');
                return;
            }
            
            if (!Utils.validatePassword(userData.password)) {
                Utils.showNotification('Password must be at least 6 characters', 'error');
                return;
            }
            
            const result = await AuthService.register(userData);
            
            if (result.success) {
                Utils.showNotification('Registration successful! Please login.', 'success');
                showLoginForm();
            } else {
                Utils.showNotification(result.error || 'Registration failed', 'error');
            }
        });
    }
    
    // Logout button
    document.addEventListener('click', function(e) {
        if (e.target.closest('.logout-btn')) {
            AuthService.logout();
        }
    });
}

// ==================== GLOBAL FUNCTIONS ====================
function showLoginForm() {
    const container = document.getElementById('authContainer');
    if (container) {
        container.innerHTML = UIComponents.createLoginForm();
        setupEventListeners();
    }
}

function showRegisterForm() {
    const container = document.getElementById('authContainer');
    if (container) {
        container.innerHTML = UIComponents.createRegisterForm();
        setupEventListeners();
    }
}

function toggleFavorite(photoId) {
    Utils.showNotification('Added to favorites', 'success');
}

function sharePhoto(photoId) {
    if (navigator.share) {
        navigator.share({
            title: 'Check out this photo!',
            text: 'From PhotoShare Azure Application',
            url: window.location.origin + '/photo/' + photoId
        });
    } else {
        // Fallback
        navigator.clipboard.writeText(window.location.origin + '/photo/' + photoId);
        Utils.showNotification('Link copied to clipboard!', 'success');
    }
}

// ==================== EXPORT FOR GLOBAL ACCESS ====================
window.PhotoShare = {
    Config: CONFIG,
    Auth: AuthService,
    Api: ApiService,
    PhotoService: PhotoService,
    Utils: Utils,
    UI: UIComponents,
    Gallery: PhotoGallery,
    State: appState
};