import { useParams } from 'react-router-dom';
import { useContext } from 'react';
import { EmployeeContext } from '../context/EmployeeContext';

const ProfilePage = () => {
  const { id } = useParams();
  const { employees } = useContext(EmployeeContext);
  const employee = employees.find(e => e.id.toString() === id);

  if (!employee) return <div className="p-6">Employee not found</div>;

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-center mb-4">Employee Profile</h2>
      <div className="space-y-2">
        <p><strong>ID:</strong> {employee.id}</p>
        <p><strong>Name:</strong> {employee.name}</p>
        <p><strong>Email:</strong> {employee.email}</p>
        <p><strong>Department:</strong> {employee.department}</p>
        <p><strong>Phone:</strong> {employee.phone || 'N/A'}</p>
        <p><strong>Address:</strong> {employee.address || 'N/A'}</p>
        <p><strong>Joining Date:</strong> {employee.joiningDate || 'N/A'}</p>
        <p><strong>Emergency Contact:</strong> {employee.emergency || 'N/A'}</p>
      </div>
    </div>
  );
};

export default ProfilePage;
