import React from 'react';
import { X, Download, ExternalLink, QrCode } from 'lucide-react';

const EmployeeQRCodeModal = ({ isOpen, onClose, qrCodeUrl, portfolioUrl, employeeName }) => {
  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${employeeName ? employeeName.replace(/\s+/g, '_') : 'Employee'}_QR_Code.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download QR code", error);
      // Fallback: open in new tab if download fails due to CORS (Cloudinary URLs should support it though)
      window.open(qrCodeUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Portfolio QR Code</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center justify-center text-center">
          {qrCodeUrl ? (
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <img 
                src={qrCodeUrl} 
                alt="Employee Portfolio QR Code" 
                className="relative w-48 h-48 object-contain bg-white rounded-xl shadow-sm border border-gray-100 p-2"
              />
            </div>
          ) : (
            <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200 border-dashed">
              <span className="text-gray-400 font-medium">QR Code Not Available</span>
            </div>
          )}
          
          <p className="mt-6 text-sm text-gray-600 font-medium">
            Scan this code to view the public portfolio
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => window.open(portfolioUrl, '_blank')}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm w-full sm:w-auto"
          >
            <ExternalLink className="w-4 h-4" />
            Open Link
          </button>
          
          <button
            onClick={handleDownload}
            disabled={!qrCodeUrl}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all shadow-sm w-full sm:w-auto
              ${qrCodeUrl 
                ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-md' 
                : 'bg-blue-400 cursor-not-allowed opacity-70'
              }`}
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeQRCodeModal;
