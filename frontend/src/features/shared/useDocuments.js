import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documentsApi.js';

export function useDocuments(courseId) {
  return useQuery({
    queryKey: ['documents', { courseId }],
    queryFn: () => documentsApi.list(courseId ? { courseId } : {}),
  });
}

export function useDocumentDetail(id) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useDocumentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });
  return {
    create: useMutation({ mutationFn: documentsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => documentsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: documentsApi.remove, onSuccess: invalidate }),
  };
}

export function getFileMeta(format, link, hasFile, fileName = '') {
  if (link && !hasFile) {
    return {
      icon: 'fa-link',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
      label: 'Liên kết',
      type: 'link',
    };
  }

  let ext = (format || '').toLowerCase().replace(/^\./, '');
  if (!ext || ext === 'raw' || ext === 'image' || ext === 'file') {
    const match = /\.([a-zA-Z0-9]+)$/i.exec(fileName || '');
    if (match) ext = match[1].toLowerCase();
  }

  if (ext === 'pdf') {
    return {
      icon: 'fa-file-pdf',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
      label: 'PDF',
      type: 'pdf',
      canPreview: true,
    };
  }

  if (['doc', 'docx'].includes(ext)) {
    return {
      icon: 'fa-file-word',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
      label: 'Word',
      type: 'word',
      canPreview: true,
    };
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: 'fa-file-excel',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      label: ext === 'csv' ? 'CSV' : 'Excel',
      type: 'excel',
      canPreview: true,
    };
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return {
      icon: 'fa-file-powerpoint',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      label: 'PowerPoint',
      type: 'powerpoint',
      canPreview: true,
    };
  }

  if (['txt', 'md', 'markdown', 'log', 'json'].includes(ext)) {
    return {
      icon: 'fa-file-lines',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      badgeColor: 'text-slate-700 bg-slate-100 border-slate-200',
      label: ext === 'md' ? 'Markdown' : 'Văn bản TXT',
      type: 'text',
      canPreview: true,
    };
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return {
      icon: 'fa-file-image',
      color: 'text-violet-600 bg-violet-50 border-violet-200',
      badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
      label: 'Hình ảnh',
      type: 'image',
      canPreview: true,
    };
  }

  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return {
      icon: 'fa-file-video',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      label: 'Video',
      type: 'video',
      canPreview: true,
    };
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      icon: 'fa-file-zipper',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
      label: 'Tệp nén',
      type: 'archive',
      canPreview: false,
    };
  }

  return {
    icon: 'fa-file-lines',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    label: ext ? ext.toUpperCase() : 'Tài liệu',
    type: 'document',
    canPreview: true,
  };
}

/** Fetch a download URL or trigger direct browser download. */
export async function downloadDocument(id, docName) {
  try {
    const res = await documentsApi.download(id);
    const targetUrl = res?.url || documentsApi.getFileUrl(id, { download: true });
    const fileName = res?.name || docName || 'tai-lieu';

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    const streamUrl = documentsApi.getFileUrl(id, { download: true });
    window.open(streamUrl, '_blank', 'noopener');
  }
}

/** Open document in a separate dedicated viewer tab */
export function openDocumentInNewTab(id) {
  if (!id) return;
  window.open(`/documents/${id}/view`, '_blank', 'noopener');
}
