"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Download, Upload, FileText, Video, FileImage, Search, Eye, X } from "lucide-react";

interface Resource {
  _id: string;
  title: string;
  description: string;
  type: string;
  courseCode: string;
  level: number;
  url: string;
  driveFileId?: string;
  youtubeVideoId?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy: string;
  uploaderName: string;
  tags: string[];
  downloadCount: number;
  viewCount: number;
  isApproved: boolean;
  createdAt: string;
}

const RESOURCE_TYPES = [
  { value: "all", label: "All Types", icon: BookOpen },
  { value: "slide", label: "Slides", icon: FileImage },
  { value: "pastQuestion", label: "Past Questions", icon: FileText },
  { value: "note", label: "Notes", icon: FileText },
  { value: "textbook", label: "Textbooks", icon: BookOpen },
  { value: "video", label: "Videos", icon: Video },
];

const LEVELS = [
  { value: "all", label: "All Levels" },
  { value: 100, label: "100 Level" },
  { value: 200, label: "200 Level" },
  { value: 300, label: "300 Level" },
  { value: 400, label: "400 Level" },
  { value: 500, label: "500 Level" },
];

export default function LibraryPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasUploadPermission, setHasUploadPermission] = useState(false);

  // Add resource form state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    type: "note",
    courseCode: "",
    level: 300,
    tags: "",
    url: "",
  });

  useEffect(() => {
    fetchResources();
    checkPermissions();
  }, [typeFilter, levelFilter]);

  const checkPermissions = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/v1/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setHasUploadPermission(
          userData.permissions?.includes("resource:upload") ||
          userData.permissions?.includes("admin:all")
        );
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchResources = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (levelFilter !== "all") params.append("level", levelFilter.toString());
      params.append("approved", "true");
      params.append("pageSize", "50");

      const response = await fetch(`/api/v1/resources?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setResources(data.resources);
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.url || !user) return;

    try {
      setUploading(true);
      const token = await user.getIdToken();

      const response = await fetch("/api/v1/resources/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(uploadForm),
      });

      if (response.ok) {
        alert("Resource added successfully! It will appear after approval.");
        setShowUploadModal(false);
        setUploadForm({
          title: "",
          description: "",
          type: "note",
          courseCode: "",
          level: 300,
          tags: "",
          url: "",
        });
        fetchResources();
      } else {
        const error = await response.json();
        alert(`Failed to add resource: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error adding resource:", error);
      alert("Failed to add resource");
    } finally {
      setUploading(false);
    }
  };

  const handleViewResource = async (resourceId: string, url: string, type: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      await fetch(`/api/v1/resources/${resourceId}/download`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Open resource in new tab
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getTypeIcon = (type: string) => {
    const typeObj = RESOURCE_TYPES.find((t) => t.value === type);
    return typeObj?.icon || FileText;
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
              Resource Library
            </h1>
            <p className="text-foreground/60">
              Access study materials, past questions, and lecture notes
            </p>
          </div>

          {hasUploadPermission && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl hover:from-primary/90 hover:to-primary/70 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Add Resource</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, course code, or tags..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder-foreground/50"
            />
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            {RESOURCE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    typeFilter === type.value
                      ? "bg-primary text-white shadow-md"
                      : "bg-background/60 text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Level Filter */}
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setLevelFilter(level.value)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  levelFilter === level.value
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-background/60 text-foreground/70 hover:bg-foreground/5 border border-transparent"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6 animate-pulse"
              >
                <div className="h-6 bg-foreground/10 rounded mb-3" />
                <div className="h-4 bg-foreground/10 rounded mb-2 w-3/4" />
                <div className="h-4 bg-foreground/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground/60 mb-2">No resources found</h3>
            <p className="text-foreground/40">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource) => {
              const TypeIcon = getTypeIcon(resource.type);
              return (
                <div
                  key={resource._id}
                  className="group bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] hover:border-primary/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
                      <TypeIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-foreground/50">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {resource.viewCount}
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        {resource.downloadCount}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-heading font-bold text-lg text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-foreground/60 mb-4 line-clamp-2">
                    {resource.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg border border-primary/20">
                      {resource.courseCode}
                    </span>
                    <span className="px-2.5 py-1 bg-foreground/5 text-foreground/70 text-xs font-medium rounded-lg">
                      {resource.level}L
                    </span>
                    {resource.fileSize && (
                      <span className="px-2.5 py-1 bg-foreground/5 text-foreground/70 text-xs font-medium rounded-lg">
                        {formatFileSize(resource.fileSize)}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {resource.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-foreground/5 text-foreground/50 text-xs rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-foreground/5">
                    <span className="text-xs text-foreground/40">By {resource.uploaderName}</span>
                    <button
                      onClick={() =>
                        handleViewResource(resource._id, resource.url, resource.type)
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg font-medium text-sm transition-all hover:scale-105 active:scale-95"
                    >
                      {resource.type === "video" ? (
                        <>
                          <Eye className="w-4 h-4" />
                          Watch
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          View
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-foreground/10 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-heading font-bold text-foreground">Add Resource</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddResource} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="e.g., Thermodynamics Lecture Notes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">Description</label>
                <textarea
                  required
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                  placeholder="Brief description of the resource..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">Type</label>
                  <select
                    value={uploadForm.type}
                    onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="note">Note</option>
                    <option value="slide">Slide</option>
                    <option value="pastQuestion">Past Question</option>
                    <option value="textbook">Textbook</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">Level</label>
                  <select
                    value={uploadForm.level}
                    onChange={(e) => setUploadForm({ ...uploadForm, level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">Course Code</label>
                <input
                  type="text"
                  required
                  value={uploadForm.courseCode}
                  onChange={(e) => setUploadForm({ ...uploadForm, courseCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="e.g., MEE 301"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="e.g., thermodynamics, heat transfer, exam prep"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">
                  URL (Google Drive or YouTube)
                </label>
                <input
                  type="url"
                  required
                  value={uploadForm.url}
                  onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-foreground/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={
                    uploadForm.type === "video"
                      ? "https://www.youtube.com/watch?v=..."
                      : "https://drive.google.com/file/d/..."
                  }
                />
                <p className="text-xs text-foreground/50 mt-1.5">
                  {uploadForm.type === "video"
                    ? "📺 Paste a YouTube video link"
                    : "📁 Paste a Google Drive shareable link (right-click file → Share → Copy link)"}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl font-medium hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {uploading ? "Adding..." : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
