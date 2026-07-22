'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Shield } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as User[];

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
      }
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive';
      case 'manager':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">Manage system users and their roles</p>
      </div>

      <Card className="p-6 border-border bg-card">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-foreground">{user.name}</td>
                    <td className="py-3 px-4 text-foreground">{user.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' && <Shield className="w-4 h-4 text-destructive" />}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {user.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6 border-border bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">User Roles Guide</h3>
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-muted/30 rounded">
            <div className="w-2 h-2 rounded-full bg-destructive mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-foreground">Admin</p>
              <p className="text-sm text-muted-foreground mt-1">
                Full system access. Can manage products, view all reports, manage users, and access settings.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-muted/30 rounded">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-foreground">Sales Staff</p>
              <p className="text-sm text-muted-foreground mt-1">
                Can record sales, view products, and check stock levels. Cannot delete products or manage users.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-muted/30 rounded">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-foreground">Store Manager</p>
              <p className="text-sm text-muted-foreground mt-1">
                Can monitor stock levels, view alerts, and access reports. Responsible for restocking decisions.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
