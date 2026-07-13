import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { getAllExpenses, updateExpenseStatus } from '../api';
import { 
  FaCheck, 
  FaTimes, 
  FaSearch, 
  FaUserTie,
  FaCalendarCheck,
  FaPaperclip,
  FaExpand,
  FaTimesCircle,
  FaFilePdf,
  FaFileImage,
  FaCalendarAlt
} from 'react-icons/fa';

const AdminExpenseDashboard = () => {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    url: '',
    type: '' // 'image' or 'pdf'
  });

  // --- Fetch All Expenses ---
  const fetchAllExpenses = async () => {
    setLoading(true);
    try {
      const res = await getAllExpenses();
      if (res.success) {
        setExpenses(res.data);
      }
    } catch (err) {
      console.error("Error fetching admin expenses", err);
      Swal.fire("Error", "Could not fetch expenses.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllExpenses();
  }, []);

  // --- Filter Logic ---
  useEffect(() => {
    if (filter === 'All') {
      setFilteredExpenses(expenses);
    } else {
      setFilteredExpenses(expenses.filter(exp => exp.status === filter));
    }
  }, [filter, expenses]);

  // --- Handle Status Update (Approve/Reject) ---
  const handleStatusUpdate = async (id, newStatus, currentAmount) => {
    const actionText = newStatus === 'Approved' ? 'Approve' : 'Reject';
    let allocatedAmountInput = undefined;

    if (newStatus === 'Approved') {
      const { value: amount, isConfirmed } = await Swal.fire({
        html: `
          <div class="text-left pt-2">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-5 shadow-sm">
              <svg class="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-2xl font-extrabold text-gray-900 text-center mb-2 tracking-tight">Approve & Allocate</h3>
            <p class="text-sm text-gray-500 text-center mb-6 px-2 leading-relaxed">Please confirm the exact funds you are allocating for this employee's expense request.</p>
            
            <div class="space-y-2 mt-4">
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Allocated Amount</label>
              <div class="relative rounded-xl shadow-sm">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span class="text-gray-400 font-semibold text-lg">₹</span>
                </div>
                <input type="number" id="allocated-amount-input" 
                  class="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full pl-10 pr-4 py-3.5 text-lg border border-gray-200 rounded-xl transition-all font-bold text-gray-900 bg-gray-50 hover:bg-white focus:bg-white focus:outline-none" 
                  placeholder="0.00" value="${currentAmount || 0}">
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirm Approval',
        cancelButtonText: 'Cancel',
        customClass: {
          popup: 'rounded-[24px] p-6 md:p-8 shadow-2xl border border-gray-100',
          confirmButton: 'w-full sm:w-auto inline-flex justify-center items-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all',
          cancelButton: 'w-full sm:w-auto inline-flex justify-center items-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 transition-all',
          actions: 'mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full px-0',
        },
        buttonsStyling: false,
        preConfirm: () => {
          const input = document.getElementById('allocated-amount-input');
          if (!input) return false;
          const value = input.value;
          if (value === '' || value < 0) {
            Swal.showValidationMessage('Please enter a valid amount (0 or more)');
            return false;
          }
          return value;
        }
      });
      if (!isConfirmed) return;
      allocatedAmountInput = amount;
    } else {
      const result = await Swal.fire({
        title: `${actionText} Expense?`,
        text: `Are you sure you want to ${actionText.toLowerCase()} this request?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: `Yes, ${actionText} it!`
      });
      if (!result.isConfirmed) return;
    }

    try {
      const res = await updateExpenseStatus(id, newStatus, allocatedAmountInput);
      
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Updated!',
          text: `Expense marked as ${newStatus}.`,
          timer: 1500,
          showConfirmButton: false
        });

        setExpenses(prevExpenses => 
          prevExpenses.map(exp => 
            exp._id === id 
              ? { ...exp, status: newStatus, actionDate: new Date(), allocatedAmount: allocatedAmountInput !== undefined ? Number(allocatedAmountInput) : exp.allocatedAmount } 
              : exp
          )
        );
        
        // Refresh data to get updated actionDate from server
        fetchAllExpenses();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to update status.', 'error');
    }
  };

  // --- Handle Receipt View ---
  const handleViewReceipt = (receiptUrl) => {
    if (!receiptUrl) {
      Swal.fire('Info', 'No receipt uploaded for this expense.', 'info');
      return;
    }

    // Check file type
    const fileExtension = receiptUrl.split('.').pop().toLowerCase();
    const isPDF = fileExtension === 'pdf';
    
    setReceiptModal({
      isOpen: true,
      url: receiptUrl,
      type: isPDF ? 'pdf' : 'image'
    });
  };

  // --- Helper: Status Badge ---
  const getStatusBadge = (status) => {
    const styles = {
      Approved: "bg-green-100 text-green-700 border-green-200",
      Rejected: "bg-red-100 text-red-700 border-red-200",
      Pending: "bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.Pending}`}>
        {status}
      </span>
    );
  };

  // --- Helper: Get file type icon ---
  const getFileIcon = (receiptUrl) => {
    if (!receiptUrl) return null;
    
    const fileExtension = receiptUrl.split('.').pop().toLowerCase();
    return fileExtension === 'pdf' ? <FaFilePdf className="text-red-500" /> : <FaFileImage className="text-blue-500" />;
  };

  // --- Helper: Format action date ---
  const formatActionDate = (actionDate) => {
    if (!actionDate) return null;
    
    return (
      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
        <FaCalendarCheck size={10} />
        {new Date(actionDate).toLocaleDateString()}
        <span className="text-gray-400 ml-1">
          ({new Date(actionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <FaUserTie className="text-blue-600" /> Admin Expense Approvals
            </h1>
            <p className="text-gray-500 mt-1">Manage employee reimbursement requests.</p>
          </div>
          
          {/* Stats Summary */}
          <div className="flex gap-3 mt-4 md:mt-0">
             <div className="bg-white px-4 py-2 rounded-lg shadow border border-gray-100 text-center min-w-[100px]">
                <span className="block text-2xl font-bold text-yellow-500">{expenses.filter(e => e.status === 'Pending').length}</span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending</span>
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow border border-gray-100 text-center min-w-[100px]">
                <span className="block text-2xl font-bold text-blue-600">{expenses.length}</span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total</span>
             </div>
          </div>
        </div>

        {/* Filters Tabs */}
        <div className="bg-white rounded-t-2xl shadow-sm border-b border-gray-200 p-2 flex gap-2 overflow-x-auto">
          {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
                filter === status 
                ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Table Content */}
        <div className="bg-white rounded-b-2xl shadow-lg border border-gray-100 overflow-hidden min-h-[400px]">
          {loading ? (
             <div className="flex justify-center items-center h-64">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
             </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-gray-400">
               <FaSearch className="text-4xl mb-3 opacity-20" />
               <p className="font-medium">No {filter !== 'All' ? filter.toLowerCase() : ''} expenses found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider font-semibold border-b border-gray-200">
                    <th className="p-4 w-1/5">Employee</th>
                    <th className="p-4 w-1/6">Category / Date</th>
                    <th className="p-4 w-1/4">Description</th>
                    <th className="p-4">Finances</th>
                    <th className="p-4">Receipt</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action Date</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-blue-50/30 transition duration-150 group">
                      
                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{expense.employeeName}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{expense.employeeCustomId || expense.employeeId}</div>
                      </td>

                      {/* Category & Date */}
                      <td className="p-4">
                         <div className="font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded text-xs mb-1">{expense.category}</div>
                         <div className="text-xs text-gray-500 flex items-center gap-1">
                            <FaCalendarAlt size={10} /> {new Date(expense.date).toLocaleDateString()}
                         </div>
                      </td>

                      {/* Description */}
                      <td className="p-4 text-gray-600">
                        <div className="truncate max-w-[200px]" title={expense.description}>
                            {expense.description || <span className="text-gray-300 italic">No description</span>}
                        </div>
                      </td>

                      {/* Finances */}
                      <td className="p-4">
                         <div className="text-xs text-gray-500 whitespace-nowrap">Spent: <span className="font-bold text-gray-800 text-sm">₹{expense.amount.toLocaleString()}</span></div>
                         {(expense.status === 'Approved' || (expense.allocatedAmount !== undefined && expense.allocatedAmount > 0)) && (
                           <>
                             <div className="text-xs text-gray-500 whitespace-nowrap">Alloc: <span className="font-bold text-gray-800 text-sm">₹{(expense.allocatedAmount || 0).toLocaleString()}</span></div>
                             {(() => {
                               const diff = (expense.allocatedAmount || 0) - expense.amount;
                               const colorClass = diff >= 0 ? "text-green-700 bg-green-100 border border-green-200" : "text-red-700 bg-red-100 border border-red-200";
                               return (
                                 <div className={`mt-1.5 inline-block px-2 py-0.5 rounded text-xs font-bold shadow-sm whitespace-nowrap ${colorClass}`}>
                                   Bal: {diff < 0 ? '-' : diff > 0 ? '+' : ''}₹{Math.abs(diff).toLocaleString()}
                                 </div>
                               );
                             })()}
                           </>
                         )}
                      </td>

                      {/* Receipt */}
                      <td className="p-4">
                        {expense.receiptUrl ? (
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => handleViewReceipt(expense.receiptUrl)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition"
                            >
                              {getFileIcon(expense.receiptUrl)}
                              <FaPaperclip /> View Receipt
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">--</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <div>
                          {getStatusBadge(expense.status)}
                          {formatActionDate(expense.actionDate)}
                        </div>
                      </td>

                      {/* Action Date */}
                      <td className="p-4 text-sm text-gray-600">
                        {expense.actionDate ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <FaCalendarCheck className="text-gray-400" size={12} />
                              {new Date(expense.actionDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(expense.actionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Actions Buttons */}
                      <td className="p-4 text-center">
                        {expense.status === 'Pending' ? (
                          <div className="flex justify-center gap-2 opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleStatusUpdate(expense._id, 'Approved', expense.amount)}
                              className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all shadow-sm tooltip"
                              title="Approve Request"
                            >
                              <FaCheck />
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(expense._id, 'Rejected')}
                              className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm tooltip"
                              title="Reject Request"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium italic">Completed</span>
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

      {/* Receipt Modal */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Receipt Preview</h3>
              <button 
                onClick={() => setReceiptModal({ isOpen: false, url: '', type: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimesCircle size={24} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              {receiptModal.type === 'pdf' ? (
                <iframe 
                  src={receiptModal.url}
                  className="w-full h-[60vh] border-0"
                  title="Receipt PDF"
                />
              ) : (
                <div className="flex justify-center">
                  <img 
                    src={receiptModal.url} 
                    alt="Receipt" 
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                    }}
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-between">
              <a 
                href={receiptModal.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
              >
                <FaExpand /> Open in New Tab
              </a>
              <button 
                onClick={() => setReceiptModal({ isOpen: false, url: '', type: '' })}
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

export default AdminExpenseDashboard;