import React from "react";
import { Save, Bell, Shield, CreditCard, Mail } from "lucide-react";

const MasterSettings = () => {
  return (
    <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Global Configuration</h2>
                <p className="text-sm text-slate-500">System wide settings and controls</p>
            </div>
            
            <div className="p-6 space-y-8">
                {/* Section 1 */}
                <div className="flex gap-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <Shield className="text-blue-600" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">Security Settings</h3>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div>
                                <p className="font-semibold text-slate-800">Two-Factor Authentication</p>
                                <p className="text-xs text-slate-500">Enforce 2FA for all tenant admins</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
                
                <hr className="border-slate-100" />

                {/* Section 2 */}
                <div className="flex gap-6">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                        <CreditCard className="text-purple-600" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">Subscription Defaults</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Free Trial Days</label>
                                <input type="number" defaultValue={14} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                                    <option>USD ($)</option>
                                    <option>EUR (€)</option>
                                    <option>INR (₹)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                 {/* Section 3 */}
                 <div className="flex gap-6">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                        <Mail className="text-amber-600" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">System Notifications</h3>
                        <div className="flex items-center gap-3">
                             <input type="checkbox" id="maint" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                             <label htmlFor="maint" className="text-sm text-slate-700">Enable Maintenance Mode banner for all users</label>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MasterSettings;