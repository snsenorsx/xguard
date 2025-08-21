import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Plus,
  Download,
  Upload,
  Trash2,
  Eye,
  Filter,
  RefreshCw
} from 'lucide-react';

interface BlacklistEntry {
  id: string;
  ipAddress: string;
  reason: string;
  detectionType: 'bot' | 'suspicious' | 'manual';
  confidenceScore: number;
  detectionCount: number;
  firstDetected: string;
  lastDetected: string;
  expiresAt?: string;
  isPermanent: boolean;
  campaignId?: string;
  userId?: string;
}

interface BlacklistStats {
  totalBlacklisted: number;
  activeBots: number;
  expiringSoon: number;
  permanentBans: number;
  recentDetections: number;
}

const BlacklistPage: React.FC = () => {
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [stats, setStats] = useState<BlacklistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newDetectionType, setNewDetectionType] = useState<'bot' | 'suspicious' | 'manual'>('manual');
  const [isPermanent, setIsPermanent] = useState(false);
  const [expiresHours, setExpiresHours] = useState(24);

  useEffect(() => {
    loadBlacklistData();
    loadStats();
  }, [currentPage, searchTerm, filterType]);

  const loadBlacklistData = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(filterType !== 'all' && { detectionType: filterType })
      });

      const response = await fetch(`/api/blacklist?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBlacklistEntries(data.entries);
        setTotalPages(Math.ceil(data.total / data.limit));
      }
    } catch (error) {
      console.error('Error loading blacklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/blacklist/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const addToBlacklist = async () => {
    try {
      const payload = {
        ipAddress: newIP,
        reason: newReason,
        detectionType: newDetectionType,
        isPermanent,
        ...(isPermanent ? {} : { 
          expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString() 
        })
      };

      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewIP('');
        setNewReason('');
        loadBlacklistData();
        loadStats();
      }
    } catch (error) {
      console.error('Error adding to blacklist:', error);
    }
  };

  const removeFromBlacklist = async (ip: string) => {
    if (!confirm(`${ip} adresini kara listeden kaldırmak istediğinize emin misiniz?`)) return;

    try {
      const response = await fetch(`/api/blacklist/${ip}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        loadBlacklistData();
        loadStats();
      }
    } catch (error) {
      console.error('Error removing from blacklist:', error);
    }
  };

  const checkIPStatus = async (ip: string) => {
    try {
      const response = await fetch(`/api/blacklist/check/${ip}`);
      if (response.ok) {
        const data = await response.json();
        alert(`IP ${ip}: ${data.isBlacklisted ? 'Kara listede' : 'Kara listede değil'}`);
      }
    } catch (error) {
      console.error('Error checking IP:', error);
    }
  };

  const getDetectionTypeColor = (type: string) => {
    switch (type) {
      case 'bot': return 'bg-red-100 text-red-800';
      case 'suspicious': return 'bg-yellow-100 text-yellow-800';
      case 'manual': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Süresi dolmuş';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} gün`;
    return `${hours} saat`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Shield className="w-8 h-8 text-red-600" />
                IP Kara Liste Yönetimi
              </h1>
              <p className="text-gray-600 mt-2">
                Tespit edilen bot IP'lerini yönetin ve merkezi kara liste sistemini kontrol edin
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
              >
                <Plus className="w-4 h-4" />
                IP Ekle
              </button>
              <button
                onClick={loadBlacklistData}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700"
              >
                <RefreshCw className="w-4 h-4" />
                Yenile
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Toplam Engellenen</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalBlacklisted}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Aktif Botlar</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeBots}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Yakında Bitecek</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.expiringSoon}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <XCircle className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Kalıcı Banlar</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.permanentBans}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Son 24 Saat</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recentDetections}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="IP adresi veya açıklama ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Tüm Tipler</option>
                <option value="bot">Bot</option>
                <option value="suspicious">Şüpheli</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Blacklist Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Kara Liste IP'leri</h3>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Yükleniyor...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Adresi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tip
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Açıklama
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Güven Skoru
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tespit Sayısı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Süre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blacklistEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.ipAddress}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(entry.firstDetected).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDetectionTypeColor(entry.detectionType)}`}>
                          {entry.detectionType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={entry.reason}>
                          {entry.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {Math.round(entry.confidenceScore * 100)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{entry.detectionCount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.isPermanent ? (
                          <span className="text-red-600 font-medium">Kalıcı</span>
                        ) : entry.expiresAt ? (
                          <span className="text-gray-600">
                            {getTimeRemaining(entry.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => checkIPStatus(entry.ipAddress)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Kontrol Et"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromBlacklist(entry.ipAddress)}
                            className="text-red-600 hover:text-red-900"
                            title="Kaldır"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span> sayfa
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? 'z-10 bg-red-50 border-red-500 text-red-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add IP Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">IP Kara Listeye Ekle</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IP Adresi</label>
                    <input
                      type="text"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                      placeholder="192.168.1.100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                    <input
                      type="text"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="Manuel ban - spam"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tespit Tipi</label>
                    <select
                      value={newDetectionType}
                      onChange={(e) => setNewDetectionType(e.target.value as 'bot' | 'suspicious' | 'manual')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="manual">Manuel</option>
                      <option value="bot">Bot</option>
                      <option value="suspicious">Şüpheli</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isPermanent}
                        onChange={(e) => setIsPermanent(e.target.checked)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Kalıcı ban</span>
                    </label>
                  </div>

                  {!isPermanent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Süre (saat)
                      </label>
                      <input
                        type="number"
                        value={expiresHours}
                        onChange={(e) => setExpiresHours(parseInt(e.target.value))}
                        min="1"
                        max="8760"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={addToBlacklist}
                    disabled={!newIP || !newReason}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Ekle
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlacklistPage;