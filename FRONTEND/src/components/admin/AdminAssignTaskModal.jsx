import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { FaTimes, FaPlus } from "react-icons/fa";
import api from "../../api";

const AdminAssignTaskModal = ({ onClose }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchTasks();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/api/employees");
      if (response.data && response.data.success) {
        setEmployees(response.data.employees || []);
      } else if (Array.isArray(response.data)) {
        setEmployees(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch employees", error);
    }
  };

  const fetchTasks = async () => {
    setTasksLoading(true);
    try {
      const response = await api.get("/api/admin-tasks");
      setAssignedTasks(response.data);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !title) {
      return Swal.fire("Required", "Please select an employee and enter a title.", "warning");
    }

    setLoading(true);
    try {
      await api.post("/api/admin-tasks", {
        employeeId: selectedEmployee,
        title,
        description,
      });
      Swal.fire("Success", "Task assigned successfully", "success");
      setTitle("");
      setDescription("");
      setSelectedEmployee("");
      fetchTasks();
    } catch (error) {
      Swal.fire("Error", "Failed to assign task", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the assigned task.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/admin-tasks/${id}`);
        Swal.fire("Deleted!", "Task has been deleted.", "success");
        fetchTasks();
      } catch (error) {
        Swal.fire("Error", "Failed to delete task", "error");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h3 className="text-xl font-bold text-gray-900">Assign Work to Employee</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col md:flex-row gap-6">
          
          {/* Assignment Form */}
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">New Assignment</h4>
            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Select Employee *</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose an Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Task Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Update Homepage UI"
                  className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Add more details about the task..."
                  className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Assigning..." : <><FaPlus /> Assign Task</>}
              </button>
            </form>
          </div>

          {/* Assigned Tasks List */}
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Assigned Tasks</h4>
            
            {tasksLoading ? (
              <div className="flex justify-center items-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
              </div>
            ) : assignedTasks.length === 0 ? (
              <div className="text-center text-slate-400 py-10 text-sm">No tasks assigned yet.</div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
                {assignedTasks.map(task => (
                  <div key={task._id} className="border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col gap-2 relative group">
                    <button 
                      onClick={() => handleDeleteTask(task._id)}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Task"
                    >
                      <FaTimes />
                    </button>
                    
                    <div className="flex justify-between items-start pr-6">
                      <h5 className="font-bold text-slate-800 text-sm">{task.title}</h5>
                    </div>
                    
                    <p className="text-xs text-slate-500">
                      Assigned to: <span className="font-semibold text-slate-700">{task.employeeId?.name}</span>
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md ${
                        task.status === "Completed" ? "bg-emerald-100 text-emerald-700" : 
                        task.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {task.status}
                      </span>
                      {task.completedAt && (
                        <span className="text-[10px] text-slate-400">
                          Completed: {new Date(task.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminAssignTaskModal;
