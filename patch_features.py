import re

with open('src/app/(student)/dashboard/messages/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add hideLastSeen state and PublicProfileModal imports
if 'import PublicProfileModal' not in content:
    content = re.sub(
        r'(import .*? from "react";)',
        r'\1\nimport PublicProfileModal from "@/components/profile/PublicProfileModal";',
        content,
        count=1
    )

# 2. Add hideLastSeen state, profile modal state, to MessagesPage
if 'const [hideLastSeen, setHideLastSeen]' not in content:
    state_code = """
  const [hideLastSeen, setHideLastSeen] = useState(false);
  const [hideLastSeenLoading, setHideLastSeenLoading] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial hideLastSeen pref
    fetch('/api/v1/users/me')
      .then(res => res.json())
      .then(data => {
        if (data.hideLastSeen !== undefined) {
          setHideLastSeen(data.hideLastSeen);
        }
      })
      .catch(console.error);
  }, []);

  const toggleHideLastSeen = async () => {
    try {
      setHideLastSeenLoading(true);
      const res = await fetch('/api/v1/users/me/hide-last-seen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideLastSeen: !hideLastSeen })
      });
      if (res.ok) {
        setHideLastSeen(!hideLastSeen);
        toast.success(Last seen status is now );
      } else {
        toast.error("Failed to update privacy settings");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setHideLastSeenLoading(false);
    }
  };
"""
    content = re.sub(
        r'(export default function MessagesPage\(\) \{\n)',
        r'\1' + state_code,
        content,
        count=1
    )

# 3. Add Hide Last Seen Button to Header
hide_btn = """
          <div className="flex items-center gap-2">
            <button
              onClick={toggleHideLastSeen}
              disabled={hideLastSeenLoading}
              className={lex items-center gap-2 px-3 py-1.5 rounded-xl border-[3px] shadow-[2px_2px_0_0_#000] text-sm font-bold transition-all }
            >
              {hideLastSeenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (hideLastSeen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />)}
              <span className="hidden sm:inline">Hide Last Seen</span>
            </button>
"""
if 'Hide Last Seen' not in content:
    content = re.sub(
        r'(<div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">.*?<div className="flex items-center gap-2">)',
        hide_btn,
        content,
        flags=re.DOTALL
    )

# 4. Avatar Clickable in Header & Profile Modal
# Replace: <img src={selectedUserAvatar} alt="" ... />
# With clickable wrapper
avatar_re = r'(<img\s+src=\{selectedUserAvatar\}\s+alt=""\s+className="w-10 h-10 rounded-full border-2 border-navy object-cover"\s*/>)'
new_avatar = r'<button onClick={() => setProfileModalUserId(otherUser?.id || selectedConv.otherUserId)} className="hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-coral rounded-full">\1</button>'
content = re.sub(avatar_re, new_avatar, content)

# 5. Fix Status indicator (Green dot, Online now / last seen)
# Replace: {isConnected ? "Connected" : "Not connected - messages go as requests"}
status_re = r'\{\s*isConnected\s*\?\s*"Connected"\s*:\s*"Not connected [^"]*"\s*\}'
new_status = r'{isConnected ? <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-navy"></div><span className="text-[#10B981] font-bold">Online now</span></div> : (selectedUserLastSeenLabel || "last seen recently")}'
content = re.sub(status_re, new_status, content)

# Also fix the one under "selectedUserLastSeenLabel ? selectedUserLastSeenLabel :"
# Actually, the logic was:
# {recordingVoice 
#    ? "Recording..." 
#    : typingUsers.has(otherUser?.id || selectedConv.otherUserId)
#      ...
#      : selectedUserLastSeenLabel ? selectedUserLastSeenLabel : isConnected ? ...
status_complex_re = r'(:\s*selectedUserLastSeenLabel\s*\?\s*selectedUserLastSeenLabel\s*:\s*isConnected\s*\?\s*)"Connected"(\s*:\s*)"Not connected.*?"'
new_complex_status = r'\1(<div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-navy shadow-[1px_1px_0_0_#000]"></div><span className="text-[#10B981] font-bold tracking-tight">Online now</span></div>)\2"Not connected"'
content = re.sub(status_complex_re, new_complex_status, content)

# 6. Add PublicProfileModal at the end of MessagesPage
modal_code = """
      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          isOpen={true}
          onClose={() => setProfileModalUserId(null)}
          onMessage={() => setProfileModalUserId(null)}
        />
      )}
    </div>
"""
if '<PublicProfileModal' not in content:
    content = re.sub(r'(</div\>\s*\n\s*\)\;\n\})', modal_code + r'\n\1', content)

# Save
with open('src/app/(student)/dashboard/messages/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully.")
