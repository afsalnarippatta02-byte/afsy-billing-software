import React, { useState, useEffect } from 'react';
import { 
  User, 
  KeyRound, 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Save, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Mail, 
  Phone, 
  Sliders, 
  Lock, 
  Users, 
  FileText, 
  Wallet, 
  Sparkles, 
  ClipboardList, 
  Settings as SettingsIcon,
  AlertCircle,
  X,
  Check,
  Cloud
} from 'lucide-react';
import { UserAccount, UserRole, StaffPermissions } from '../types';
import { DEFAULT_STAFF_PERMISSIONS } from '../services/userService';
import { syncToGoogleDriveCloud } from '../services/driveService';

interface UserManagementSettingsProps {
  currentUser: UserAccount;
  users?: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onUpdateCurrentUser: (updatedUser: UserAccount) => void;
}

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({
  currentUser,
  users = [],
  onUpdateUsers,
  onUpdateCurrentUser,
}) => {
  const safeUsers = Array.isArray(users) ? users : [];
  // My Account (Current logged in user profile & password)
  const [profileUsername, setProfileUsername] = useState(currentUser.username);
  const [profileName, setProfileName] = useState(currentUser.name || currentUser.username);
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  
  // Password change fields for current user
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Staff Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [staffUsername, setStaffUsername] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>(UserRole.STAFF);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions>(DEFAULT_STAFF_PERMISSIONS);
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [showAdminAuthPass, setShowAdminAuthPass] = useState(false);
  const [modalError, setModalError] = useState('');

  // Primary 1st Admin in the system
  const primaryAdmin = safeUsers.find(u => u.role === UserRole.ADMIN);

  // Keep local profile form in sync if currentUser prop changes
  useEffect(() => {
    setProfileUsername(currentUser.username);
    setProfileName(currentUser.name || currentUser.username);
    setProfileEmail(currentUser.email || '');
    setProfilePhone(currentUser.phone || '');
  }, [currentUser]);

  // Handle My Profile / Username / Password Update
  const handleSaveMyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);

    const trimmedUsername = profileUsername.trim();
    if (!trimmedUsername) {
      setProfileFeedback({ type: 'error', message: 'Username cannot be blank.' });
      return;
    }

    // Check if new username conflicts with another existing user
    const userConflict = safeUsers.find(u => u.id !== currentUser.id && u.username.toLowerCase() === trimmedUsername.toLowerCase());
    if (userConflict) {
      setProfileFeedback({ type: 'error', message: `Username "${trimmedUsername}" is already taken by another account.` });
      return;
    }

    // Check password if changing
    let updatedPassword = currentUser.password;
    if (newPassword) {
      if (newPassword.length < 4) {
        setProfileFeedback({ type: 'error', message: 'New password must be at least 4 characters.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
        return;
      }
      if (currentUser.password && currentPassword !== currentUser.password) {
        setProfileFeedback({ type: 'error', message: 'Current password entered is incorrect.' });
        return;
      }
      updatedPassword = newPassword;
    }

    const updatedUser: UserAccount = {
      ...currentUser,
      username: trimmedUsername,
      name: profileName.trim() || trimmedUsername,
      email: profileEmail.trim() || undefined,
      phone: profilePhone.trim() || undefined,
      password: updatedPassword,
    };

    // Update in users array
    const updatedUsers = safeUsers.map(u => u.id === currentUser.id ? updatedUser : u);
    onUpdateUsers(updatedUsers);
    onUpdateCurrentUser(updatedUser);

    // Sync to Google Drive cloud
    if (updatedUser.email) {
      syncToGoogleDriveCloud(updatedUser.email).catch(() => {});
    }

    // Reset password fields
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setProfileFeedback({ type: 'success', message: 'Profile credentials and Google Drive sync saved successfully!' });
    setTimeout(() => setProfileFeedback(null), 4000);
  };

  // Open modal to create new staff or edit existing
  const handleOpenStaffModal = (userToEdit?: UserAccount) => {
    setModalError('');
    setAdminAuthPassword('');
    setShowAdminAuthPass(false);
    if (userToEdit) {
      setEditingUserId(userToEdit.id);
      setStaffUsername(userToEdit.username);
      setStaffName(userToEdit.name || userToEdit.username);
      setStaffPassword(userToEdit.password);
      setStaffEmail(userToEdit.email || '');
      setStaffPhone(userToEdit.phone || '');
      setStaffRole(userToEdit.role);
      setStaffPermissions(userToEdit.permissions || DEFAULT_STAFF_PERMISSIONS);
    } else {
      setEditingUserId(null);
      setStaffUsername('');
      setStaffName('');
      setStaffPassword('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffRole(UserRole.STAFF);
      setStaffPermissions(DEFAULT_STAFF_PERMISSIONS);
    }
    setIsModalOpen(true);
  };

  // Save staff in modal
  const handleSaveStaffModal = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    // Device security check: If there is an existing 1st main Admin account, verify main Admin password
    if (primaryAdmin && primaryAdmin.password) {
      if (!adminAuthPassword) {
        setModalError('1st Main Admin Password is required to authorize adding or modifying accounts on this device.');
        return;
      }
      if (adminAuthPassword !== primaryAdmin.password) {
        setModalError('Authentication failed: 1st Main Admin password is incorrect.');
        return;
      }
    }

    const cleanUsername = staffUsername.trim();
    if (!cleanUsername) {
      setModalError('Username is required.');
      return;
    }
    if (staffPassword.length < 4) {
      setModalError('Password must be at least 4 characters.');
      return;
    }

    // Check duplicate username
    const conflict = safeUsers.find(u => 
      u.id !== editingUserId && 
      u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (conflict) {
      setModalError(`Username "${cleanUsername}" is already taken.`);
      return;
    }

    let updatedUsersList: UserAccount[];

    if (editingUserId) {
      // Edit
      updatedUsersList = safeUsers.map(u => {
        if (u.id === editingUserId) {
          const updated: UserAccount = {
            ...u,
            username: cleanUsername,
            name: staffName.trim() || cleanUsername,
            password: staffPassword,
            email: staffEmail.trim() || undefined,
            phone: staffPhone.trim() || undefined,
            role: staffRole,
            permissions: staffRole === UserRole.ADMIN ? undefined : staffPermissions,
          };
          if (editingUserId === currentUser.id) {
            onUpdateCurrentUser(updated);
          }
          return updated;
        }
        return u;
      });
    } else {
      // Create new staff
      const newStaff: UserAccount = {
        id: `staff-${Date.now()}`,
        username: cleanUsername,
        name: staffName.trim() || cleanUsername,
        password: staffPassword,
        email: staffEmail.trim() || undefined,
        phone: staffPhone.trim() || undefined,
        role: staffRole,
        permissions: staffRole === UserRole.ADMIN ? undefined : staffPermissions,
        createdAt: new Date().toISOString().split('T')[0]
      };
      updatedUsersList = [...safeUsers, newStaff];
    }

    onUpdateUsers(updatedUsersList);
    setIsModalOpen(false);

    // Trigger cloud auto-sync if currentUser has email
    if (currentUser.email) {
      syncToGoogleDriveCloud(currentUser.email).catch(() => {});
    }
  };

  // Delete staff user
  const handleDeleteUser = (userId: string, username: string) => {
    if (userId === currentUser.id) {
      alert('You cannot delete your own currently active logged-in account.');
      return;
    }

    if (primaryAdmin && primaryAdmin.password) {
      const enteredPassword = window.prompt(`Security Verification Required:\nEnter the 1st Main Admin password to delete user "${username}":`);
      if (enteredPassword === null) return;
      if (enteredPassword !== primaryAdmin.password) {
        alert('Authentication failed: 1st Main Admin password is incorrect.');
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to permanently delete user "${username}"?`)) {
        return;
      }
    }

    const updated = safeUsers.filter(u => u.id !== userId);
    onUpdateUsers(updated);
    if (currentUser.email) {
      syncToGoogleDriveCloud(currentUser.email).catch(() => {});
    }
  };

  // Toggle permission checkbox
  const handleTogglePermission = (key: keyof StaffPermissions) => {
    setStaffPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* ========================================================================= */}
      {/* SECTION A: MY ACCOUNT CREDENTIALS */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <User className="text-indigo-600 dark:text-indigo-400" size={22} />
              My Account & Credentials
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Update your username, password, recovery email for OTP, and Google Drive sync.
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl self-start sm:self-auto ${
            isAdmin 
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}>
            <ShieldCheck size={14} />
            <span>Role: {currentUser.role}</span>
          </span>
        </div>

        {/* Feedback Alert */}
        {profileFeedback && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in ${
            profileFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}>
            {profileFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{profileFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveMyProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                Login Username <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. admin or your_name"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">This is the username used to sign in to the portal.</p>
            </div>

            {/* Display Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
                Full Display Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. Afsal Narippatta"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Shown in the top right user menu and audit activity.</p>
            </div>

            {/* Recovery Email (for OTP & Google Drive Auto-Sync) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud size={14} className="text-indigo-600 dark:text-indigo-400" />
                Google Drive & Recovery Email
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. afsalnarippatta02@gmail.com"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Used for Google Drive cloud sync and 6-digit OTP password recovery.</p>
            </div>

            {/* Recovery Mobile (for OTP) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={14} className="text-indigo-600 dark:text-indigo-400" />
                Recovery Mobile Number
              </label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. +971 50 123 4567"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Used for SMS / WhatsApp mobile verification.</p>
            </div>
          </div>

          {/* Change Password Block */}
          <div className="p-6 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Lock size={15} className="text-indigo-600 dark:text-indigo-400" />
              Change Login Password (Optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="New password (min 4 chars)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Repeat new password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-2 transition-all active:scale-95"
            >
              <Save size={16} />
              <span>Save Account Credentials</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* SECTION B: STAFF USER MANAGEMENT & CUSTOM PERMISSIONS (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <Users className="text-indigo-600 dark:text-indigo-400" size={22} />
                Staff Users & Custom Permissions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Create staff accounts with custom usernames, passwords, and fine-grained module access controls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenStaffModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95 self-start sm:self-auto"
            >
              <UserPlus size={16} />
              <span>Add New Staff User</span>
            </button>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Permissions / Access</th>
                  <th className="py-3 px-4">Recovery Contact</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {safeUsers.map(u => {
                  const isCurrent = u.id === currentUser.id;
                  const uAdmin = u.role === UserRole.ADMIN;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            uAdmin 
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {u.name ? u.name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.name || u.username}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md font-extrabold">You</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          uAdmin 
                            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {uAdmin ? <ShieldCheck size={12} /> : <User size={12} />}
                          <span>{u.role}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {uAdmin ? (
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Full System Access (Unrestricted)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.permissions?.canCreateInvoices && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">Invoices</span>}
                            {u.permissions?.canManageClients && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">Clients</span>}
                            {u.permissions?.canLogExpenses && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">Expenses</span>}
                            {u.permissions?.canViewStaff && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">Staff</span>}
                            {u.permissions?.canUseGemini && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">AI Helper</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {u.email && <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1"><Mail size={11} className="text-slate-400" />{u.email}</div>}
                          {u.phone && <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1"><Phone size={11} className="text-slate-400" />{u.phone}</div>}
                          {!u.email && !u.phone && <span className="text-[11px] text-slate-400 italic">No contact set</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenStaffModal(u)}
                            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Credentials & Permissions"
                          >
                            <Edit3 size={15} />
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT STAFF USER & PERMISSIONS */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingUserId ? 'Edit User Credentials & Access' : 'Create New Staff User'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Configure login credentials and module permissions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStaffModal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. accountant_ali"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Ali Mohammed"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Login Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Password (min 4 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showStaffPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Google Drive / Recovery Email
                  </label>
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="staff@company.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+971 50 000 0000"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  User Role
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={UserRole.STAFF}>Staff User (Module Controlled)</option>
                  <option value={UserRole.ADMIN}>Administrator (Full Access)</option>
                </select>
              </div>

              {/* Permissions checkboxes (Only if STAFF role) */}
              {staffRole === UserRole.STAFF && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Fine-Grained Module Permissions
                  </h4>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPermissions.canCreateInvoices}
                        onChange={() => handleTogglePermission('canCreateInvoices')}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Can create & edit Invoices / Quotations</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPermissions.canManageClients}
                        onChange={() => handleTogglePermission('canManageClients')}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Can manage Client Directory & TRN Tax details</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPermissions.canLogExpenses}
                        onChange={() => handleTogglePermission('canLogExpenses')}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Can log business Expenses & Petty Cash</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPermissions.canViewStaff}
                        onChange={() => handleTogglePermission('canViewStaff')}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Can view Staff Payroll & Attendance</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPermissions.canUseGemini}
                        onChange={() => handleTogglePermission('canUseGemini')}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Can access Gemini AI Financial Advisor</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Primary Admin Authorization Requirement */}
              {primaryAdmin && primaryAdmin.password && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <label className="text-xs font-black text-amber-900 dark:text-amber-200">
                      1st Main Admin Authorization Password <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Device Security: To add or edit user accounts (Admin/Staff), enter the 1st Main Admin's password ({primaryAdmin.username}).
                  </p>
                  <div className="relative pt-1">
                    <input
                      type={showAdminAuthPass ? 'text' : 'password'}
                      required
                      value={adminAuthPassword}
                      onChange={(e) => setAdminAuthPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Enter 1st Main Admin Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminAuthPass(!showAdminAuthPass)}
                      className="absolute right-3 top-1/2 translate-y-[-25%] text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {showAdminAuthPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  {editingUserId ? 'Save User Changes' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagementSettings;
