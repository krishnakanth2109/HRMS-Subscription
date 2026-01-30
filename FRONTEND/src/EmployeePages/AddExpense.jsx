import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { 
  FaMoneyBillWave, 
  FaFileUpload, 
  FaPaperPlane, 
  FaHistory, 
  FaCalendarAlt, 
  FaPaperclip, 
  FaSearch,
  FaPlus,
  FaTimes,
  FaCheckCircle,
  FaHourglassHalf,
  FaFilePdf,
  FaFileImage,
  FaCalendarCheck
} from 'react-icons/fa';

const AddExpense = () => {
  // 1. Get User from Context
  const { user } = useContext(AuthContext);

  // --- STATES ---
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // Default to today
    description: ''
  });
  
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // New State for Modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for Expense History
  const [expenseHistory, setExpenseHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // State for Receipt Preview Modal
  const [receiptPreview, setReceiptPreview] = useState({
    isOpen: false,
    url: '',
    type: ''
  });

  // --- FETCH EXPENSES FUNCTION ---
  const fetchExpenses = async () => {
    if (!user || !user._id) return;
    
    try {
      const res = await axios.get(`http://localhost:5000/api/expenses/employee/${user._id}`);
      if (res.data.success) {
        setExpenseHistory(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching history", err);
      Swal.fire("Error", "Failed to load expense history", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- USE EFFECT ---
  useEffect(() => {
    fetchExpenses();
  }, [user]);

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire("Error", "File size should be less than 5MB", "error");
        e.target.value = null;
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire("Error", "Only JPG, PNG, and PDF files are allowed", "error");
        e.target.value = null;
        return;
      }
      
      setReceipt(file);
    }
  };

  const clearReceipt = () => {
    setReceipt(null);
    const fileInput = document.getElementById('receiptInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // --- CALCULATE SUMMARY STATS (Dynamic UI) ---
  const totalSpent = expenseHistory.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingCount = expenseHistory.filter(e => e.status === 'Pending').length;
  const approvedCount = expenseHistory.filter(e => e.status === 'Approved').length;

  // --- SUBMIT FORM ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      Swal.fire("Error", "User not authenticated", "error");
      return;
    }

    // Validate form data
    if (!formData.category) {
      Swal.fire("Error", "Please select a category", "error");
      return;
    }
    
    if (!formData.amount || Number(formData.amount) <= 0) {
      Swal.fire("Error", "Please enter a valid amount", "error");
      return;
    }

    setLoading(true);

    const data = new FormData();
    data.append('employeeId', user._id); 
    data.append('employeeCustomId', user.employeeId); 
    data.append('employeeName', user.name);
    data.append('category', formData.category);
    data.append('amount', formData.amount);
    data.append('date', formData.date);
    data.append('description', formData.description);
    
    if (receipt) {
      data.append('receipt', receipt);
    }

    try {
      const res = await axios.post('http://localhost:5000/api/expenses/add', data, {
        headers: { 
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds timeout
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('Upload Progress:', percentCompleted + '%');
        }
      });

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Submitted Successfully!',
          text: 'Expense sent for approval.',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Reset Form & Close Modal
        setFormData({
          category: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: ''
        });
        setReceipt(null);
        setIsModalOpen(false);

        // Refresh List
        fetchExpenses();
      }
    } catch (err) {
      console.error("Submission error:", err);
      
      let errorMessage = "Failed to submit expense. Please try again.";
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = "Request timeout. Please check your internet connection and try again.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      Swal.fire(
        "Submission Failed", 
        errorMessage, 
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Handle Receipt View ---
  const handleViewReceipt = (receiptUrl) => {
    if (!receiptUrl) {
      Swal.fire('Info', 'No receipt available for this expense.', 'info');
      return;
    }

    // Check file type
    const fileExtension = receiptUrl.split('.').pop().toLowerCase();
    const isPDF = fileExtension === 'pdf';
    
    setReceiptPreview({
      isOpen: true,
      url: receiptUrl,
      type: isPDF ? 'pdf' : 'image'
    });
  };

  // --- Helper: Get file type icon ---
  const getFileIcon = (receiptUrl) => {
    if (!receiptUrl) return null;
    
    const fileExtension = receiptUrl.split('.').pop().toLowerCase();
    return fileExtension === 'pdf' ? <FaFilePdf className="text-red-500" /> : <FaFileImage className="text-blue-500" />;
  };

  // --- HELPER: Status Badge ---
  const getStatusBadge = (status) => {
    const styles = {
      Approved: "bg-green-100 text-green-700 border-green-200",
      Rejected: "bg-red-100 text-red-700 border-red-200",
      Pending: "bg-yellow-100 text-yellow-700 border-yellow-200"
    };
    
    const icons = {
      Approved: <FaCheckCircle className="inline mr-1" />,
      Rejected: <FaTimes className="inline mr-1" />,
      Pending: <FaHourglassHalf className="inline mr-1" />
    };

    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
        {icons[status]} {status}
      </span>
    );
  };

  // --- Helper: Format action date ---
  const formatActionDate = (actionDate, status) => {
    if (!actionDate || status === 'Pending') return null;
    
    return (
      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
        <FaCalendarCheck size={10} />
        {new Date(actionDate).toLocaleDateString()} 
        <span className="text-gray-400 ml-1">({new Date(actionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 flex items-center gap-3">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 rounded-xl">
                  <FaMoneyBillWave />
                </div>
                My Expenses
              </h1>
              <p className="text-gray-500 mt-2">Track and manage your submitted expenses</p>
            </div>

            {/* Add Expense Button */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <FaPlus /> Add New Expense
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Total Spent</p>
                  <p className="text-3xl font-bold mt-1">₹{totalSpent.toLocaleString()}</p>
                </div>
                <FaMoneyBillWave size={32} className="opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-5 shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Pending</p>
                  <p className="text-3xl font-bold mt-1">{pendingCount}</p>
                </div>
                <FaHourglassHalf size={32} className="opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl p-5 shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-green-100 text-sm font-medium">Approved</p>
                  <p className="text-3xl font-bold mt-1">{approvedCount}</p>
                </div>
                <FaCheckCircle size={32} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {/* EXPENSE HISTORY */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <FaHistory className="text-indigo-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">Expense History</h2>
          </div>

          {loadingHistory ? (
            <div className="text-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading expenses...</p>
            </div>
          ) : expenseHistory.length === 0 ? (
            <div className="text-center py-12">
              <FaHistory className="mx-auto text-gray-300" size={64} />
              <p className="text-gray-500 mt-4 text-lg">No expenses submitted yet.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
              >
                Submit Your First Expense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Date</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Category</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Description</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Amount</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Action Date</th>
                    <th className="text-left p-4 text-xs font-bold text-gray-600 uppercase">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenseHistory.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-gray-400" />
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-800">{expense.category}</td>
                      <td className="p-4 text-sm text-gray-600 max-w-xs truncate">{expense.description || '-'}</td>
                      <td className="p-4 text-sm font-bold text-gray-900">₹{Number(expense.amount).toLocaleString()}</td>
                      <td className="p-4">
                        <div>
                          {getStatusBadge(expense.status)}
                          {formatActionDate(expense.actionDate, expense.status)}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {expense.actionDate ? (
                          <div className="flex items-center gap-2">
                            <FaCalendarCheck className="text-gray-400" />
                            {new Date(expense.actionDate).toLocaleDateString()}
                            <span className="text-xs text-gray-400">
                              {new Date(expense.actionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {expense.receiptUrl ? (
                          <button 
                            onClick={() => handleViewReceipt(expense.receiptUrl)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm transition"
                          >
                            {getFileIcon(expense.receiptUrl)}
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">No receipt</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                   <FaMoneyBillWave />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Add Expense</h2>
                  <p className="text-blue-100 text-xs">Fill details below</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white transition">
                <FaTimes size={20} />
              </button>
            </div>

            {/* Modal Body (Form) */}
            <div className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category *</label>
                    <select 
                      name="category" 
                      value={formData.category} 
                      onChange={handleInputChange} 
                      required 
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="Travel">Travel</option>
                      <option value="Food">Food</option>
                      <option value="Office Supplies">Office Supplies</option>
                      <option value="Accommodation">Accommodation</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (₹) *</label>
                    <input 
                      type="number" 
                      name="amount" 
                      value={formData.amount} 
                      onChange={handleInputChange} 
                      required 
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date *</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={formData.date} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                  <textarea 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    placeholder="Brief description..."
                    rows="2"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm resize-none"
                  />
                </div>

                {/* File Upload Styling */}
                <div className="relative group">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Receipt (Optional)</label>
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${receipt ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-blue-50 hover:border-blue-300'}`}>
                    <input 
                      id="receiptInput"
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 group-hover:text-blue-600">
                      <FaFileUpload size={24} className={receipt ? 'text-green-500' : ''} />
                      <span className="text-sm font-medium truncate w-60">
                         {receipt ? receipt.name : "Click to upload file (JPG, PNG, PDF)"}
                      </span>
                      <span className="text-xs text-gray-400">
                        Max size: 5MB
                      </span>
                    </div>
                  </div>
                  {receipt && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-green-600 font-medium">
                        ✓ File selected: {receipt.type.includes('pdf') ? 'PDF' : 'Image'}
                      </span>
                      <button 
                        type="button"
                        onClick={clearReceipt}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className={`flex-1 py-3 rounded-xl text-white font-bold shadow-md transition-all flex items-center justify-center gap-2 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:to-indigo-700'}`}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FaPaperPlane />
                        Submit Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {receiptPreview.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Receipt Preview</h3>
              <button 
                onClick={() => setReceiptPreview({ isOpen: false, url: '', type: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={24} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh] flex justify-center">
              {receiptPreview.type === 'pdf' ? (
                <iframe 
                  src={receiptPreview.url}
                  className="w-full h-[60vh] border-0"
                  title="Receipt PDF"
                />
              ) : (
                <img 
                  src={receiptPreview.url} 
                  alt="Receipt" 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                  }}
                />
              )}
            </div>
            <div className="p-4 border-t flex justify-between">
              <a 
                href={receiptPreview.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
              >
                <FaPlus /> Open in New Tab
              </a>
              <button 
                onClick={() => setReceiptPreview({ isOpen: false, url: '', type: '' })}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddExpense;