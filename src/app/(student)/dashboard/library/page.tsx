"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

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
  { value: "all", label: "All Types" },
  { value: "slide", label: "Slides" },
  { value: "pastQuestion", label: "Past Questions" },
  { value: "note", label: "Notes" },
  { value: "textbook", label: "Textbooks" },
  { value: "video", label: "Videos" },
];

const LEVELS: Array<{ value: "all" | number; label: string }> = [
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
    if (user) {
      fetchResources();
      checkPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, levelFilter]);

  const checkPermissions = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(getApiUrl("/api/users/me"), {
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

      const response = await fetch(getApiUrl(`/api/v1/resources?${params}`), {
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

      const response = await fetch(getApiUrl("/api/v1/resources/add"), {
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

  const handleViewResource = async (resourceId: string, url: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      await fetch(getApiUrl(`/api/v1/resources/${resourceId}/download`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

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

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Resource Library" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8">
        {/* Header Section */}
        <section className="border-t border-border pt-8 mb-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-charcoal dark:bg-cream flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl text-text-primary">
                  Study Materials
                </h2>
                <p className="text-label-sm text-text-muted">
                  Access study materials, past questions, and lecture notes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {hasUploadPermission && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  Add Resource
                </button>
              )}
              <span className="page-number">Page 01</span>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="max-w-7xl mx-auto mb-8">
          <div className="border border-border p-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-full pl-12 pr-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
            </div>

            {/* Filter Label */}
            <div className="flex items-center gap-2 text-label-sm text-text-muted pt-2">
              <span>◆</span>
              <span>Filter by Type & Level</span>
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={`px-4 py-2 text-label-sm transition-colors ${
                    typeFilter === type.value
                      ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                      : "border border-border text-text-secondary hover:border-border-dark hover:text-text-primary"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Level Filter */}
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setLevelFilter(level.value)}
                  className={`px-4 py-2 text-label-sm transition-colors ${
                    levelFilter === level.value
                      ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                      : "border border-border text-text-secondary hover:border-border-dark hover:text-text-primary"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Resources Grid */}
        <section className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border border-border p-6 animate-pulse">
                  <div className="h-6 bg-bg-secondary mb-3" />
                  <div className="h-4 bg-bg-secondary mb-2 w-3/4" />
                  <div className="h-4 bg-bg-secondary w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <h3 className="font-display text-lg text-text-secondary mb-2">
                No resources found
              </h3>
              <p className="text-body text-sm text-text-muted">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((resource, index) => (
                <article
                  key={resource._id}
                  className="border border-border hover:border-border-dark transition-colors group"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-border flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-label-sm text-text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="px-2 py-0.5 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm">
                        {resource.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-label-sm text-text-muted">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {resource.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        {resource.downloadCount}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <h3 className="font-display text-base text-text-primary group-hover:text-text-secondary transition-colors line-clamp-2">
                      {resource.title}
                    </h3>
                    <p className="text-body text-sm text-text-secondary line-clamp-2">
                      {resource.description}
                    </p>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 border border-border text-label-sm text-text-secondary">
                        {resource.courseCode}
                      </span>
                      <span className="px-2 py-0.5 border border-border text-label-sm text-text-secondary">
                        {resource.level}L
                      </span>
                      {resource.fileSize && (
                        <span className="px-2 py-0.5 border border-border text-label-sm text-text-muted">
                          {formatFileSize(resource.fileSize)}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {resource.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-label-sm text-text-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-border flex items-center justify-between">
                    <span className="text-label-sm text-text-muted truncate max-w-[150px]">
                      By {resource.uploaderName}
                    </span>
                    <button
                      onClick={() =>
                        handleViewResource(resource._id, resource.url)
                      }
                      className="flex items-center gap-2 px-4 py-2 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
                    >
                      {resource.type === "video" ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                            />
                          </svg>
                          Watch
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                          </svg>
                          View
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-charcoal/90 dark:bg-cream/90 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-primary border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-primary border-b border-border p-6 flex items-center justify-between">
              <h2 className="font-display text-lg text-text-primary flex items-center gap-2">
                <span>✦</span> Add Resource
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-bg-secondary transition-colors"
              >
                <svg
                  className="w-5 h-5 text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddResource} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">Title</label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, title: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  placeholder="e.g., Thermodynamics Lecture Notes"
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Description
                </label>
                <textarea
                  required
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors resize-none"
                  placeholder="Brief description of the resource..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">Type</label>
                  <select
                    value={uploadForm.type}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, type: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary focus:outline-none focus:border-border-dark transition-colors"
                    title="Resource type"
                  >
                    <option value="note">Note</option>
                    <option value="slide">Slide</option>
                    <option value="pastQuestion">Past Question</option>
                    <option value="textbook">Textbook</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">Level</label>
                  <select
                    value={uploadForm.level}
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        level: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary focus:outline-none focus:border-border-dark transition-colors"
                    title="Academic level"
                  >
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Course Code
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.courseCode}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      courseCode: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  placeholder="e.g., MEE 301"
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, tags: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  placeholder="e.g., thermodynamics, heat transfer, exam prep"
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  URL (Google Drive or YouTube)
                </label>
                <input
                  type="url"
                  required
                  value={uploadForm.url}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, url: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-bg-primary border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  placeholder={
                    uploadForm.type === "video"
                      ? "https://www.youtube.com/watch?v=..."
                      : "https://drive.google.com/file/d/..."
                  }
                />
                <p className="text-label-sm text-text-muted">
                  {uploadForm.type === "video"
                    ? "Paste a YouTube video link"
                    : "Paste a Google Drive shareable link"}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-3 text-label-sm border border-border text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-3 text-label-sm bg-charcoal dark:bg-cream text-cream dark:text-charcoal hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors disabled:opacity-50"
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
