import React, { useState } from 'react';

export default function ProfileEditModal({ user, open, onClose, onSave }) {
  const [username, setUsername] = useState(user?.username || '');
  const [profilePic, setProfilePic] = useState(user?.profile_pic || '');
  const [picPreview, setPicPreview] = useState(user?.profile_pic || '');

  // Handle image file selection
  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPicPreview(ev.target.result);
        setProfilePic(ev.target.result); // base64 for now
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ username, profile_pic: profilePic });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#f0efeb] via-[#cddafd] to-[#fad2e1] backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl px-8 py-10 flex flex-col gap-6 min-w-[340px] max-w-[92vw] relative border-2 border-[#e2ece9]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-3xl font-bold mb-2 text-center text-gray-800 title-font tracking-wide">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <label htmlFor="profile-pic-upload" className="relative group cursor-pointer">
              {picPreview ? (
                <img
                  src={picPreview}
                  alt="Profile Preview"
                  className="w-28 h-28 rounded-full object-cover border-4 border-[#cdb4db] shadow-lg group-hover:border-[#a685e2] transition-all duration-200"
                />
              ) : (
                <span className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-300 to-pink-300 flex items-center justify-center text-6xl font-bold text-black border-4 border-[#e2ece9] shadow-lg group-hover:border-[#a685e2] transition-all duration-200">
                  {username ? username[0].toUpperCase() : '?'}
                </span>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6M3 21h18" /></svg>
              </div>
              <input
                id="profile-pic-upload"
                type="file"
                accept="image/*"
                onChange={handlePicChange}
                className="hidden"
                aria-label="Upload profile picture"
              />
            </label>
            <span className="text-xs text-gray-500 mt-1">Click image to change</span>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="username-input" className="text-sm font-semibold text-gray-800 mb-1">Username</label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-5 py-3 rounded-full border-2 border-[#e2ece9] focus:border-[#bfc9d1] bg-white text-lg font-semibold text-gray-800 shadow-sm focus:ring-2 focus:ring-[#e2ece9]/30 transition-all title-font tracking-wide"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#fde2e4] via-[#fad2e1] to-[#fff1e6] text-gray-700 font-semibold border border-[#eae4e9] shadow-lg hover:shadow-2xl hover:from-[#fad2e1] hover:via-[#fff1e6] hover:to-[#e2ece9] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#cddafd] via-[#dfe7fd] to-[#bee1e6] text-gray-800 font-bold shadow-lg border-2 border-[#e2ece9] hover:from-[#bee1e6] hover:via-[#f0efeb] hover:to-[#fad2e1] transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
