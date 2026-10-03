import React, { useState, useEffect, useMemo } from 'react';
import api from './api';
import { 
  Wrench, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  LogOut, 
  AlertCircle, 
  CheckCircle,
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  PackageCheck,
  AlertTriangle,
  PackageX
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleAuthLogout = () => {
      setToken(null);
      setCurrentUser(null);
    };
    window.addEventListener('auth-logout', handleAuthLogout);
    return () => window.removeEventListener('auth-logout', handleAuthLogout);
  }, []);

  const handleLoginSuccess = (accessToken, refreshToken, user) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    setToken(accessToken);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setToken(null);
      setCurrentUser(null);
    }
  };

  if (!token) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <CatalogDashboard 
      user={currentUser} 
      onLogout={handleLogout} 
    />
  );
}

// -------------------------------------------------------------
// LOGIN COMPONENT (Purple & White Split Card Design)
// -------------------------------------------------------------
function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { username: username.trim(), password });
      if (res.data.status === 'success' || res.data.access_token) {
        onLoginSuccess(
          res.data.access_token, 
          res.data.refresh_token, 
          res.data.user || { username }
        );
      } else {
        setError('Login failed. Please verify your credentials.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Invalid username or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-modal-box">
        <div className="login-visual-accent">
          <div className="accent-circle">
            <Wrench size={32} color="#ffffff" strokeWidth={2.4} />
          </div>
          <h3>JR MOTOPARTS</h3>
          <p>Motorcycle Parts & Inventory Portal</p>
        </div>

        <div className="login-form-area">
          <div className="login-prompt">
            <h2>Welcome Back</h2>
            <p>Enter your credentials to access inventory control</p>
          </div>

          {error && (
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label>Account Username</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                autoFocus
              />
            </div>

            <div className="field-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-text" 
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn-purple-primary" 
              style={{ width: '100%', marginTop: '0.75rem' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DASHBOARD COMPONENT (Catalog / Split Layout - No Stat Boxes)
// -------------------------------------------------------------
function CatalogDashboard({ user, onLogout }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('id-asc'); // 'id-asc' | 'id-desc' | 'price-asc' | 'price-desc' | 'name-asc' | 'stock-desc'

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);
  
  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/products');
      const list = res.data?.data || res.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err) {
      showToast('Could not load motorcycle parts from API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered & Sorted items
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    
    let result = products.filter(p => {
      const matchSearch = p.product_name?.toLowerCase().includes(q) || 
                          p.description?.toLowerCase().includes(q);
      if (!matchSearch) return false;

      const qty = parseInt(p.quantity, 10) || 0;
      if (activeFilter === 'in_stock') return qty > 10;
      if (activeFilter === 'low_stock') return qty > 0 && qty <= 10;
      if (activeFilter === 'out_of_stock') return qty === 0;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'id-asc') return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
      if (sortBy === 'id-desc') return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
      if (sortBy === 'price-asc') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      if (sortBy === 'price-desc') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      if (sortBy === 'name-asc') return (a.product_name || '').localeCompare(b.product_name || '');
      if (sortBy === 'stock-desc') return (parseInt(b.quantity, 10) || 0) - (parseInt(a.quantity, 10) || 0);
      return 0;
    });

    return result;
  }, [products, search, activeFilter, sortBy]);

  // Counts for sidebar tabs
  const counts = useMemo(() => {
    return {
      all: products.length,
      in_stock: products.filter(p => (parseInt(p.quantity, 10) || 0) > 10).length,
      low_stock: products.filter(p => {
        const q = parseInt(p.quantity, 10) || 0;
        return q > 0 && q <= 10;
      }).length,
      out_of_stock: products.filter(p => (parseInt(p.quantity, 10) || 0) === 0).length,
    };
  }, [products]);

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setModalMode('create');
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setModalMode('edit');
  };

  const handleSaveProduct = async (formData) => {
    try {
      if (modalMode === 'create') {
        const res = await api.post('/api/products', formData);
        showToast(res.data?.message || 'Motorcycle part added to catalog!');
      } else if (modalMode === 'edit' && selectedProduct) {
        const res = await api.put(`/api/products/${selectedProduct.id}`, formData);
        showToast(res.data?.message || 'Part details updated successfully!');
      }
      setModalMode(null);
      fetchProducts();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Error saving item';
      showToast(msg, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProduct) return;
    try {
      await api.delete(`/api/products/${deleteProduct.id}`);
      showToast('Part removed from inventory');
      setDeleteProduct(null);
      fetchProducts();
    } catch (err) {
      showToast('Failed to delete item', 'error');
    }
  };

  return (
    <div className="catalog-layout">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="catalog-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo-cube">
            <Wrench size={20} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">JR MOTOPARTS</div>
            <div className="brand-subtitle">Inventory Hub</div>
          </div>
        </div>

        <div className="sidebar-section-label">Inventory Filters</div>
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles size={16} />
              <span>All Products</span>
            </div>
            <span className="count-pill">{counts.all}</span>
          </button>

          <button 
            className={`nav-item ${activeFilter === 'in_stock' ? 'active' : ''}`}
            onClick={() => setActiveFilter('in_stock')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <PackageCheck size={16} />
              <span>In Stock</span>
            </div>
            <span className="count-pill">{counts.in_stock}</span>
          </button>

          <button 
            className={`nav-item ${activeFilter === 'low_stock' ? 'active' : ''}`}
            onClick={() => setActiveFilter('low_stock')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={16} />
              <span>Low Stock</span>
            </div>
            <span className="count-pill warning">{counts.low_stock}</span>
          </button>

          <button 
            className={`nav-item ${activeFilter === 'out_of_stock' ? 'active' : ''}`}
            onClick={() => setActiveFilter('out_of_stock')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <PackageX size={16} />
              <span>Out of Stock</span>
            </div>
            <span className="count-pill danger">{counts.out_of_stock}</span>
          </button>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-user-footer">
          <div className="user-info-row">
            <div className="user-avatar-purple">
              {(user?.username?.[0] || 'J').toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username || 'admin'}</span>
              <span className="user-status">Active Session</span>
            </div>
          </div>
          <button onClick={onLogout} className="btn-sidebar-logout" title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="catalog-main">
        {/* Top Control Bar */}
        <header className="catalog-topbar">
          <div className="topbar-search-box">
            <Search size={16} className="search-icon-muted" />
            <input 
              type="text" 
              placeholder="Search parts by name, model or specs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="search-clear-btn">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="topbar-actions">
            {/* Sort Dropdown */}
            <div className="sort-selector-wrapper">
              <SlidersHorizontal size={14} className="sort-icon" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="id-asc">Sort: ID (1 → 20)</option>
                <option value="id-desc">Sort: ID (Newest)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="stock-desc">Stock: High to Low</option>
              </select>
              <ChevronDown size={14} className="dropdown-arrow" />
            </div>

            {/* View Toggle */}
            <div className="view-mode-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Compact List View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Add Part Button */}
            <button onClick={handleOpenCreate} className="btn-purple-primary">
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Part</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="catalog-scroll-area">
          <div className="catalog-header-info">
            <h2>
              {activeFilter === 'all' && 'All Motorcycle Parts'}
              {activeFilter === 'in_stock' && 'In Stock Parts'}
              {activeFilter === 'low_stock' && 'Low Stock Parts'}
              {activeFilter === 'out_of_stock' && 'Out of Stock Parts'}
            </h2>
            <p className="catalog-count-info">
              Displaying {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
              {search && ` matching "${search}"`}
            </p>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <p>Loading motorcycle inventory...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <PackageX size={44} color="#a855f7" />
              <h3>No parts found</h3>
              <p>Try searching for different keywords or clear your active filter.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* ========================================================
               GRID VIEW (Catalog Cards Design)
               ======================================================== */
            <div className="parts-card-grid">
              {filteredProducts.map((p) => {
                const qty = parseInt(p.quantity, 10) || 0;
                return (
                  <div key={p.id} className="part-card">
                    <div className="card-top-row">
                      <span className="part-id-tag">PART #{p.id}</span>
                      <span className={`stock-status-pill ${qty > 10 ? 'in-stock' : qty > 0 ? 'low-stock' : 'out-of-stock'}`}>
                        {qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </div>

                    <h3 className="part-name-title">{p.product_name}</h3>
                    
                    <p className="part-spec-desc">
                      {p.description || 'Standard OEM replacement part'}
                    </p>

                    <div className="part-card-footer">
                      <div className="part-price-box">
                        <span className="price-label">Price</span>
                        <div className="price-amount">
                          ₱{parseFloat(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="part-quantity-box">
                        <span className="price-label">Units</span>
                        <div className="quantity-val">{qty} pcs</div>
                      </div>

                      <div className="card-quick-actions">
                        <button 
                          onClick={() => handleOpenEdit(p)} 
                          className="action-icon-btn edit"
                          title="Edit Part"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          onClick={() => setDeleteProduct(p)} 
                          className="action-icon-btn delete"
                          title="Delete Part"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================
               LIST VIEW (Modern Clean Data Rows)
               ======================================================== */
            <div className="list-container-card">
              <div className="list-header-row">
                <span className="col-id">ID</span>
                <span className="col-name">Part Name</span>
                <span className="col-desc">Description</span>
                <span className="col-price">Price</span>
                <span className="col-stock">Stock</span>
                <span className="col-actions">Actions</span>
              </div>
              <div className="list-rows">
                {filteredProducts.map((p) => {
                  const qty = parseInt(p.quantity, 10) || 0;
                  return (
                    <div key={p.id} className="list-item-row">
                      <span className="col-id part-id-tag">#{p.id}</span>
                      <span className="col-name" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {p.product_name}
                      </span>
                      <span className="col-desc" style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>
                        {p.description || '—'}
                      </span>
                      <span className="col-price price-amount">
                        ₱{parseFloat(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="col-stock">
                        <span className={`stock-status-pill ${qty > 10 ? 'in-stock' : qty > 0 ? 'low-stock' : 'out-of-stock'}`}>
                          {qty} pcs
                        </span>
                      </span>
                      <span className="col-actions">
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button 
                            onClick={() => handleOpenEdit(p)} 
                            className="action-icon-btn edit"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => setDeleteProduct(p)} 
                            className="action-icon-btn delete"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Modal */}
      {modalMode && (
        <ProductFormModal 
          mode={modalMode}
          product={selectedProduct}
          onClose={() => setModalMode(null)}
          onSave={handleSaveProduct}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteProduct && (
        <div className="modal-backdrop">
          <div className="modal-dialog delete-confirm">
            <div className="dialog-header">
              <h3>Delete Motorcycle Part</h3>
              <button onClick={() => setDeleteProduct(null)} className="btn-close">
                <X size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <p>
                Are you sure you want to remove <strong>{deleteProduct.product_name}</strong>?
              </p>
              <p className="note-text">
                This item will be permanently removed from the Aiven database catalog.
              </p>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setDeleteProduct(null)} className="btn-plain">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="btn-danger-solid">
                Yes, Delete Part
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// FORM MODAL (Add / Edit Part)
// -------------------------------------------------------------
function ProductFormModal({ mode, product, onClose, onSave }) {
  const [productName, setProductName] = useState(product?.product_name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price || '');
  const [quantity, setQuantity] = useState(product?.quantity ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Please provide a part name');
      return;
    }
    if (price === '' || isNaN(price) || parseFloat(price) < 0) {
      setError('Please enter a valid price in ₱');
      return;
    }
    if (quantity === '' || isNaN(quantity) || parseInt(quantity, 10) < 0) {
      setError('Please enter valid stock quantity');
      return;
    }

    onSave({
      product_name: productName.trim(),
      description: description.trim(),
      price: parseFloat(price).toFixed(2),
      quantity: parseInt(quantity, 10),
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="dialog-header">
          <h3>{mode === 'create' ? 'Add New Motorcycle Part' : 'Edit Part Details'}</h3>
          <button onClick={onClose} className="btn-close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            {error && (
              <div className="alert-box error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="field-group">
              <label>Part Name & Model *</label>
              <input 
                type="text" 
                className="input-text" 
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Brembo 4-Piston Caliper"
                required
                autoFocus
              />
            </div>

            <div className="field-group">
              <label>Description & Technical Compatibility</label>
              <textarea 
                className="input-text textarea" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specifications, compatibility, material, dimensions..."
              />
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label>Price (₱) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="input-text" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="field-group">
                <label>Stock Quantity *</label>
                <input 
                  type="number" 
                  step="1"
                  min="0"
                  className="input-text" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>

          <div className="dialog-footer">
            <button type="button" onClick={onClose} className="btn-plain">
              Cancel
            </button>
            <button type="submit" className="btn-purple-primary">
              {mode === 'create' ? 'Save to Catalog' : 'Update Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
