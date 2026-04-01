import React, { useState, useEffect } from 'react';
// Import the functions we added to your api.js
import {
    getPayrollCandidates,
    managePayrollCandidate,
    deletePayrollCandidate
} from '../api';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const PayrollPage = () => {
    const [candidates, setCandidates] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isProfilePicOpen, setIsProfilePicOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editId, setEditId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTableLoading, setIsTableLoading] = useState(true);

    // All fields included with new salary fields
    const [formData, setFormData] = useState({
        fullName: '', email: '', phone: '', gender: 'Male', dob: '', address: '',
        profilePic: '',
        companyName: '', department: '', designation: '', employmentType: 'Full Time', joiningDate: '',
        agreedSalary: '', pfDeduction: '', ptDeduction: '', otherDeductions: '', netSalary: '',
        bankName: '', accountHolderName: '', accountNumber: '', ifscCode: '', branch: '',
        uanNumber: '', esiNumber: ''
    });
    const [files, setFiles] = useState({ profilePic: null, panDoc: null, aadhaarDoc: null });
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        loadCandidates();
    }, []);

    const loadCandidates = async () => {
        try {
            setIsTableLoading(true);
            // ✅ Updated: Using api.js function instead of local axios
            const data = await getPayrollCandidates();
            setCandidates(data);
        } catch (err) {
            console.error("Error fetching", err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load candidates. Please try again.',
                confirmButtonColor: '#3085d6',
            });
        } finally {
            setIsTableLoading(false);
        }
    };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Auto-calculate net salary when salary fields change
            if (name === 'agreedSalary' || name === 'pfDeduction' || name === 'ptDeduction' || name === 'otherDeductions') {
                const agreedSalary = parseFloat(updated.agreedSalary) || 0;
                const pfDeduction = parseFloat(updated.pfDeduction) || 0;
                const ptDeduction = parseFloat(updated.ptDeduction) || 0;
                const otherDeductions = parseFloat(updated.otherDeductions) || 0;

                const totalDeductions = pfDeduction + ptDeduction + otherDeductions;
                updated.netSalary = (agreedSalary - totalDeductions).toFixed(2);
            }

            return updated;
        });
    };

    const handleFileChange = (e, fileType) => {
        const file = e.target.files[0];
        setFiles(prev => ({ ...prev, [fileType]: file }));

        if (fileType === 'profilePic' && file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Show loading Swal
        Swal.fire({
            title: editId ? 'Updating Candidate...' : 'Saving Candidate...',
            text: 'Please wait while we process your request',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const data = new FormData();

        // Append all text fields
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
                data.append(key, formData[key]);
            }
        });

        // Append files
        if (files.profilePic) data.append('profilePic', files.profilePic);
        if (files.panDoc) data.append('panDoc', files.panDoc);
        if (files.aadhaarDoc) data.append('aadhaarDoc', files.aadhaarDoc);

        try {
            // ✅ Updated: Using api.js function (handles live URL and edit logic)
            await managePayrollCandidate(data, editId);

            // Close Swal and show success message
            Swal.close();
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: editId ? 'Candidate updated successfully!' : 'Candidate saved successfully!',
                confirmButtonColor: '#10b981',
                timer: 2000,
                showConfirmButton: false
            });

            setIsFormOpen(false);
            setEditId(null);
            setFormData({
                fullName: '', email: '', phone: '', gender: 'Male', dob: '', address: '', profilePic: '',
                companyName: '', department: '', designation: '', employmentType: 'Full Time',
                joiningDate: '', agreedSalary: '', pfDeduction: '', ptDeduction: '', otherDeductions: '', netSalary: '',
                bankName: '', accountHolderName: '', accountNumber: '', ifscCode: '', branch: '',
                uanNumber: '', esiNumber: ''
            });
            setFiles({ profilePic: null, panDoc: null, aadhaarDoc: null });
            setPreviewImage(null);
            loadCandidates();
        } catch (err) {
            console.error(err);
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to save candidate. Please try again.',
                confirmButtonColor: '#3085d6',
            });
        }
    };

    const deleteUser = async (id, fullName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete ${fullName}. This action cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                Swal.fire({
                    title: 'Deleting...',
                    text: 'Please wait',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // ✅ Updated: Using api.js function
                await deletePayrollCandidate(id);

                Swal.close();
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Candidate has been deleted.',
                    confirmButtonColor: '#10b981',
                    timer: 1500,
                    showConfirmButton: false
                });

                loadCandidates();
            } catch (err) {
                console.error(err);
                Swal.close();
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete candidate. Please try again.',
                    confirmButtonColor: '#3085d6',
                });
            }
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    return (
        <div className="">
            <div className="p-6 bg-gray-50 rounded-xl flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Payroll Candidates Management</h1>
                    <p className="text-gray-600 mt-1">Manage Payroll Candidates information and documents</p>
                </div>
                <button
                    onClick={() => {
                        setEditId(null);
                        setIsFormOpen(true);
                        setFormData({
                            fullName: '', email: '', phone: '', gender: 'Male', dob: '', address: '', profilePic: '',
                            companyName: '', department: '', designation: '', employmentType: 'Full Time',
                            joiningDate: '', agreedSalary: '', pfDeduction: '', ptDeduction: '', otherDeductions: '', netSalary: '',
                            bankName: '', accountHolderName: '', accountNumber: '', ifscCode: '', branch: '',
                            uanNumber: '', esiNumber: ''
                        });
                        setFiles({ profilePic: null, panDoc: null, aadhaarDoc: null });
                        setPreviewImage(null);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Add Candidate
                </button>
            </div>

            {/* TABLE - SCROLLABLE WITH SINGLE LINE CONTENT */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="text-lg font-semibold text-gray-800">All Candidates ({candidates.length})</h2>
                </div>

                {isTableLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600">Loading candidates...</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-gray-400 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-gray-700 mb-2">No candidates found</h3>
                        <p className="text-gray-500 mb-6">Add your first candidate to get started</p>
                        <button
                            onClick={() => { setEditId(null); setIsFormOpen(true); }}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            Add First Candidate
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full">
                        <div className="min-w-[1300px]">
                            <table className="w-full text-left table-fixed">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="p-4 pl-6 w-20 whitespace-nowrap">Profile</th>
                                        <th className="p-4 w-40 whitespace-nowrap">Full Name</th>
                                        <th className="p-4 w-64 whitespace-nowrap">Email</th>
                                        <th className="p-4 w-30 whitespace-nowrap">Phone</th>
                                        <th className="p-4 w-35 whitespace-nowrap">Company</th>
                                        <th className="p-4 w-40 whitespace-nowrap">Designation</th>
                                        <th className="p-4 w-30 whitespace-nowrap">Net Salary</th>
                                        <th className="p-4 w-80 whitespace-nowrap text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-200">
                                    {candidates.map(user => (
                                        <tr key={user._id} className="hover:bg-blue-50 transition-colors duration-200">
                                            <td className="p-4 pl-6 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setIsProfilePicOpen(true);
                                                        }}
                                                        title="Click to view full size"
                                                    >
                                                        {user.profilePic ? (
                                                            <img
                                                                src={user.profilePic}
                                                                alt={user.fullName}
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            user.fullName.charAt(0)
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis" title={user.fullName}>
                                                {user.fullName}
                                            </td>
                                            <td className="p-4 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={user.email}>
                                                {user.email}
                                            </td>
                                            <td className="p-4 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={user.phone}>
                                                {user.phone}
                                            </td>
                                            <td className="p-4 whitespace-nowrap overflow-hidden text-ellipsis" title={user.companyName}>
                                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded truncate inline-block max-w-full">
                                                    {user.companyName}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={user.designation}>
                                                {user.designation}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 text-sm font-bold px-3 py-1 rounded-lg">
                                                    {formatCurrency(user.netSalary)}
                                                </span>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => { setSelectedUser(user); setIsViewOpen(true); }}
                                                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                                    >
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                                        </svg>
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditId(user._id);
                                                            setFormData({
                                                                ...user,
                                                                dob: user.dob?.split('T')[0],
                                                                joiningDate: user.joiningDate?.split('T')[0]
                                                            });
                                                            setIsFormOpen(true);
                                                            setPreviewImage(user.profilePic || null);
                                                        }}
                                                        className="bg-yellow-50 text-yellow-600 hover:bg-yellow-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                                    >
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(user._id, user.fullName)}
                                                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                                    >
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                        </svg>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: ADD/EDIT FORM */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-6xl p-8 overflow-y-auto max-h-[90vh] shadow-2xl animate-slideUp">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">{editId ? 'Edit Candidate' : 'Add New Candidate'}</h2>
                                <p className="text-gray-600 text-sm mt-1">Fill in all required details below</p>
                            </div>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-3xl text-gray-400 hover:text-red-500 transition-colors duration-200"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Profile Picture Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-pink-600 to-rose-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Profile Picture</h3>
                                </div>
                                <div className="flex flex-col items-center border border-gray-200 rounded-lg p-4 max-w-xs mx-auto bg-gray-50">
                                    <div className="mb-4">
                                        <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center overflow-hidden">
                                            {previewImage || formData.profilePic ? (
                                                <img
                                                    src={previewImage || formData.profilePic}
                                                    alt="Profile Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        onChange={(e) => handleFileChange(e, 'profilePic')}
                                        className="hidden"
                                        id="profilePic"
                                        accept="image/*"
                                    />
                                    <label htmlFor="profilePic" className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-semibold">
                                        {previewImage || formData.profilePic ? 'Change Profile Picture' : 'Upload Profile Picture'}
                                    </label>
                                    <p className="text-gray-500 text-sm mt-2">Passport size photo recommended</p>
                                </div>
                            </div>

                            {/* Section 1 - Employee Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Employee Details</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                        <input
                                            name="fullName"
                                            placeholder="John Doe"
                                            value={formData.fullName}
                                            onChange={handleInput}
                                            pattern="[A-Za-z\s]+"
                                            title="Only alphabets and spaces allowed"
                                            required
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                        <input name="email" type="email" placeholder="john@company.com" value={formData.email} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                        <input
                                            name="phone"
                                            placeholder="Enter 10 digit phone number"
                                            value={formData.phone}
                                            onChange={handleInput}
                                            pattern="[0-9]{10}"
                                            maxLength="10"
                                            title="Enter valid 10 digit phone number"
                                            required
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                        <select name="gender" value={formData.gender} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleInput}
                                            max={new Date().toISOString().split("T")[0]}
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <input name="address" placeholder="Full Address" value={formData.address} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2 - Job Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Job Details</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                                        <input
                                            name="companyName"
                                            placeholder="Company Name"
                                            value={formData.companyName}
                                            onChange={handleInput}
                                            pattern="[A-Za-z\s]+"
                                            title="Only alphabets allowed"
                                            required
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                        <input name="department" placeholder="Engineering" value={formData.department} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                                        <input name="designation" placeholder="Software Engineer" value={formData.designation} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                                        <select name="employmentType" value={formData.employmentType} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                                            <option value="Full Time">Full Time</option>
                                            <option value="Part Time">Part Time</option>
                                            <option value="Intern">Intern</option>
                                            <option value="Contract">Contract</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                                        <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3 - Salary Details (NEW) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Salary Details</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Agreed Salary (₹)</label>
                                        <input
                                            name="agreedSalary"
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="50000"
                                            value={formData.agreedSalary}
                                            onChange={handleInput}
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">PF Deduction (₹)</label>
                                        <input name="pfDeduction" type="number" placeholder="1800" value={formData.pfDeduction} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">PT Deduction (₹)</label>
                                        <input name="ptDeduction" type="number" placeholder="200" value={formData.ptDeduction} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Other Deductions (₹)</label>
                                        <input name="otherDeductions" type="number" placeholder="500" value={formData.otherDeductions} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Net Salary (₹)</label>
                                        <input name="netSalary" type="number" value={formData.netSalary} readOnly className="w-full border border-green-300 bg-green-50 p-3 rounded-lg font-bold text-green-700" />
                                        <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4 - Bank Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Bank Details</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                        <input name="bankName" placeholder="Bank Name" pattern="[A-Za-z\s]+"
                                            title="Only alphabets allowed" value={formData.bankName} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                                        <input name="accountHolderName" pattern="[A-Za-z\s]+"
                                            title="Only alphabets allowed" placeholder="Account Holder Name" value={formData.accountHolderName} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                        <input name="accountNumber" pattern="[0-9]{9,18}"
                                            title="Enter valid account number (9-18 digits)" placeholder="Account Number" value={formData.accountNumber} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                        <input name="ifscCode" pattern="^[A-Z]{4}0[A-Z0-9]{6}$"
                                            title="Enter valid IFSC Code (e.g. SBIN0001234)"
                                            style={{ textTransform: "uppercase" }} placeholder="IFSC Code" value={formData.ifscCode} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                                        <input name="branch" placeholder="Branch" value={formData.branch} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 5 - Compliance & Documents */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-r from-orange-600 to-red-600 rounded-full"></div>
                                    <h3 className="text-lg font-bold text-gray-800">Compliance & Documents</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card Upload</label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                                                <input
                                                    type="file"
                                                    onChange={(e) => setFiles({ ...files, panDoc: e.target.files[0] })}
                                                    className="hidden"
                                                    id="panDoc"
                                                />
                                                <label htmlFor="panDoc" className="cursor-pointer">
                                                    <div className="flex flex-col items-center">
                                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                                        </svg>
                                                        <p className="text-sm text-gray-600">
                                                            {files.panDoc ? files.panDoc.name : 'Click to upload PAN document'}
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">UAN Number</label>
                                            <input name="uanNumber" pattern="[0-9]{12}"
                                                title="Enter valid 12 digit UAN number" placeholder="UAN Number" value={formData.uanNumber} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Card Upload</label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                                                <input
                                                    type="file"
                                                    onChange={(e) => setFiles({ ...files, aadhaarDoc: e.target.files[0] })}
                                                    className="hidden"
                                                    id="aadhaarDoc"
                                                />
                                                <label htmlFor="aadhaarDoc" className="cursor-pointer">
                                                    <div className="flex flex-col items-center">
                                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                                        </svg>
                                                        <p className="text-sm text-gray-600">
                                                            {files.aadhaarDoc ? files.aadhaarDoc.name : 'Click to upload Aadhaar document'}
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ESI Number</label>
                                            <input name="esiNumber" pattern="[0-9]{17}"
                                                title="Enter valid 17 digit ESI number" placeholder="ESI Number" value={formData.esiNumber} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-10 py-3 rounded-lg shadow-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-semibold flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    {editId ? 'Update Candidate' : 'Save Candidate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PROFILE PICTURE VIEW MODAL */}
            {isProfilePicOpen && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-8 relative shadow-2xl animate-slideUp">
                        <button
                            onClick={() => setIsProfilePicOpen(false)}
                            className="absolute top-4 right-4 text-3xl text-gray-400 hover:text-red-500 transition-colors duration-200 z-10"
                        >
                            &times;
                        </button>

                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedUser.fullName}</h2>
                            <p className="text-gray-600 mb-6">Profile Picture</p>

                            <div className="flex justify-center mb-6">
                                <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-xl">
                                    {selectedUser.profilePic ? (
                                        <img
                                            src={selectedUser.profilePic}
                                            alt={selectedUser.fullName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white text-4xl font-bold">
                                            {selectedUser.fullName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => setIsProfilePicOpen(false)}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW MORE MODAL (UPDATED WITH SALARY DETAILS) */}
            {isViewOpen && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-5xl p-8 relative shadow-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
                        <button
                            onClick={() => setIsViewOpen(false)}
                            className="absolute top-6 right-6 text-3xl text-gray-400 hover:text-red-500 transition-colors duration-200 z-10"
                        >
                            &times;
                        </button>

                        <div className="mb-8">
                            <div className="flex items-center gap-4 mb-4">
                                <div
                                    className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-3xl font-bold cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                        setIsViewOpen(false);
                                        setIsProfilePicOpen(true);
                                    }}
                                    title="Click to view full size"
                                >
                                    {selectedUser.profilePic ? (
                                        <img
                                            src={selectedUser.profilePic}
                                            alt={selectedUser.fullName}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        selectedUser.fullName.charAt(0)
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedUser.fullName}</h2>
                                    <p className="text-gray-600">{selectedUser.designation} • {selectedUser.companyName}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Employee Details Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                    Employee Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b border-blue-100 pb-2">
                                        <span className="text-gray-600">Email:</span>
                                        <span className="font-medium">{selectedUser.email}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-blue-100 pb-2">
                                        <span className="text-gray-600">Phone:</span>
                                        <span className="font-medium">{selectedUser.phone}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-blue-100 pb-2">
                                        <span className="text-gray-600">Gender:</span>
                                        <span className="font-medium">{selectedUser.gender}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-blue-100 pb-2">
                                        <span className="text-gray-600">Date of Birth:</span>
                                        <span className="font-medium">{new Date(selectedUser.dob).toLocaleDateString()}</span>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-gray-600 mb-1">Address:</p>
                                        <p className="font-medium">{selectedUser.address}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Job Details Card */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                    Job Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b border-green-100 pb-2">
                                        <span className="text-gray-600">Company:</span>
                                        <span className="font-medium">{selectedUser.companyName}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-green-100 pb-2">
                                        <span className="text-gray-600">Department:</span>
                                        <span className="font-medium">{selectedUser.department}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-green-100 pb-2">
                                        <span className="text-gray-600">Designation:</span>
                                        <span className="font-medium">{selectedUser.designation}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-green-100 pb-2">
                                        <span className="text-gray-600">Employment Type:</span>
                                        <span className="font-medium">{selectedUser.employmentType}</span>
                                    </div>
                                    <div className="flex justify-between pt-2">
                                        <span className="text-gray-600">Joining Date:</span>
                                        <span className="font-medium">{new Date(selectedUser.joiningDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Salary Details Card (NEW) */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    Salary Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b border-amber-100 pb-2">
                                        <span className="text-gray-600">Agreed Salary:</span>
                                        <span className="font-bold text-green-700">{formatCurrency(selectedUser.agreedSalary)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-amber-100 pb-2">
                                        <span className="text-gray-600">PF Deduction:</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(selectedUser.pfDeduction)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-amber-100 pb-2">
                                        <span className="text-gray-600">PT Deduction:</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(selectedUser.ptDeduction)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-amber-100 pb-2">
                                        <span className="text-gray-600">Other Deductions:</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(selectedUser.otherDeductions)}</span>
                                    </div>
                                    <div className="flex justify-between pt-2">
                                        <span className="text-gray-600 font-bold">Net Salary:</span>
                                        <span className="font-bold text-xl text-green-700">
                                            {formatCurrency(selectedUser.netSalary)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details Card */}
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                    </svg>
                                    Bank Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b border-purple-100 pb-2">
                                        <span className="text-gray-600">Bank Name:</span>
                                        <span className="font-medium">{selectedUser.bankName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-purple-100 pb-2">
                                        <span className="text-gray-600">Account Holder:</span>
                                        <span className="font-medium">{selectedUser.accountHolderName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-purple-100 pb-2">
                                        <span className="text-gray-600">Account Number:</span>
                                        <span className="font-medium">{selectedUser.accountNumber || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-purple-100 pb-2">
                                        <span className="text-gray-600">IFSC Code:</span>
                                        <span className="font-medium">{selectedUser.ifscCode || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between pt-2">
                                        <span className="text-gray-600">Branch:</span>
                                        <span className="font-medium">{selectedUser.branch || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Compliance Card */}
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    Compliance & Documents
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">UAN Number:</span>
                                            <span className="font-medium">{selectedUser.uanNumber || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">ESI Number:</span>
                                            <span className="font-medium">{selectedUser.esiNumber || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-gray-600 mb-3">Uploaded Documents:</p>
                                        <div className="flex gap-3">
                                            {selectedUser.panDoc && (
                                                <a
                                                    href={selectedUser.panDoc}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition-colors duration-200 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                    </svg>
                                                    View PAN
                                                </a>
                                            )}
                                            {selectedUser.aadhaarDoc && (
                                                <a
                                                    href={selectedUser.aadhaarDoc}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-600 transition-colors duration-200 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                    </svg>
                                                    View Aadhaar
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add CSS animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default PayrollPage;