'use client';

// Staff Attendance Tracking Component
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Clock,
  Calendar,
  Download,
  Filter,
  UserCheck,
  UserX,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  FileDown,
  LogIn,
  LogOut,
  CalendarDays,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  status: string;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  notes: string | null;
  user: StaffMember;
}

interface AttendanceStats {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  avgAttendanceRate: number;
}

export default function AttendanceTracking() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  // Clock in/out dialog
  const [isClockDialogOpen, setIsClockDialogOpen] = useState(false);
  const [selectedStaffForClock, setSelectedStaffForClock] = useState<StaffMember | null>(null);
  const [clockAction, setClockAction] = useState<'in' | 'out'>('in');
  const [clockNotes, setClockNotes] = useState('');

  const departments = useMemo(() => {
    const depts = new Set(staff.map(s => s.department).filter(Boolean));
    return ['all', ...Array.from(depts)];
  }, [staff]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch staff list
      const staffRes = await fetch('/api/users');
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData.users || []);
      }

      // Fetch attendance records
      const params = new URLSearchParams({
        startDate,
        endDate,
        staffId: selectedStaff !== 'all' ? selectedStaff : '',
        department: selectedDepartment !== 'all' ? selectedDepartment : '',
      });
      
      const attendanceRes = await fetch(`/api/staff/attendance?${params}`);
      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        setAttendance(attendanceData.records || []);
        setStats(attendanceData.stats || null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedStaff, selectedDepartment]);

  const handleClockAction = async () => {
    if (!selectedStaffForClock) return;

    try {
      const response = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffForClock.id,
          type: clockAction,
          notes: clockNotes,
        }),
      });

      if (!response.ok) throw new Error('Failed to record clock action');

      toast.success(`Clocked ${clockAction} successfully for ${selectedStaffForClock.firstName}`);
      setIsClockDialogOpen(false);
      setClockNotes('');
      setSelectedStaffForClock(null);
      fetchData();
    } catch (error) {
      toast.error(`Failed to clock ${clockAction}`);
    }
  };

  const openClockDialog = (member: StaffMember, action: 'in' | 'out') => {
    setSelectedStaffForClock(member);
    setClockAction(action);
    setIsClockDialogOpen(true);
  };

  const exportAttendance = (format: 'csv' | 'json') => {
    const data = attendance.map(record => ({
      Date: record.date,
      Staff: `${record.user.firstName} ${record.user.lastName}`,
      Department: record.user.department || 'N/A',
      Status: record.status,
      CheckIn: record.checkIn || 'N/A',
      CheckOut: record.checkOut || 'N/A',
      LateMinutes: record.lateMinutes,
      EarlyLeaveMinutes: record.earlyLeaveMinutes,
      Notes: record.notes || '',
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${startDate}_to_${endDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV format
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    toast.success(`Exported attendance as ${format.toUpperCase()}`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; className: string; icon: React.ReactNode }> = {
      present: { variant: 'secondary', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', icon: <CheckCircle className="h-3 w-3" /> },
      absent: { variant: 'destructive', className: '', icon: <XCircle className="h-3 w-3" /> },
      late: { variant: 'outline', className: 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400', icon: <AlertCircle className="h-3 w-3" /> },
      'half-day': { variant: 'secondary', className: '', icon: <Clock className="h-3 w-3" /> },
      leave: { variant: 'secondary', className: '', icon: <CalendarDays className="h-3 w-3" /> },
    };

    const config = variants[status] || variants.present;

    return (
      <Badge variant={config.variant} className={cn('gap-1', config.className)}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Badge>
    );
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const todayStaff = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    
    return staff.map(member => {
      const record = todayAttendance.find(a => a.userId === member.id);
      return { ...member, attendanceRecord: record };
    });
  }, [staff, attendance]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Tracking</h2>
          <p className="text-muted-foreground">Monitor staff attendance and clock in/out times</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportAttendance('csv')}>
              <FileDown className="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAttendance('json')}>
              <FileDown className="mr-2 h-4 w-4" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStaff || staff.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.presentToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
            <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.absentToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Today</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.lateToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgAttendanceRate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today's Attendance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Attendance for Today</CardTitle>
              <CardDescription>Record clock in/out times for staff members</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">No staff members found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      todayStaff.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{member.firstName} {member.lastName}</p>
                              <p className="text-sm text-muted-foreground">{member.jobTitle}</p>
                            </div>
                          </TableCell>
                          <TableCell>{member.department || 'N/A'}</TableCell>
                          <TableCell>
                            {member.attendanceRecord ? (
                              getStatusBadge(member.attendanceRecord.status)
                            ) : (
                              <Badge variant="secondary">Not Clocked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.attendanceRecord?.checkIn ? (
                              formatTime(member.attendanceRecord.checkIn)
                            ) : '--:--'}
                          </TableCell>
                          <TableCell>
                            {member.attendanceRecord?.checkOut ? (
                              formatTime(member.attendanceRecord.checkOut)
                            ) : '--:--'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openClockDialog(member, 'in')}
                              disabled={!!member.attendanceRecord?.checkIn}
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              Clock In
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2"
                              onClick={() => openClockDialog(member, 'out')}
                              disabled={!member.attendanceRecord?.checkIn || !!member.attendanceRecord?.checkOut}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Clock Out
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Staff Member</Label>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger>
                      <SelectValue placeholder="All staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept === 'all' ? 'All Departments' : dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                {attendance.length} records from {startDate} to {endDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Late (min)</TableHead>
                      <TableHead>Early Leave (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Calendar className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">No attendance records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {new Date(record.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {record.user.firstName} {record.user.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{record.user.jobTitle}</p>
                            </div>
                          </TableCell>
                          <TableCell>{record.user.department || 'N/A'}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>{formatTime(record.checkIn)}</TableCell>
                          <TableCell>{formatTime(record.checkOut)}</TableCell>
                          <TableCell>
                            {record.lateMinutes > 0 ? (
                              <span className="text-yellow-600 dark:text-yellow-400">{record.lateMinutes}</span>
                            ) : 0}
                          </TableCell>
                          <TableCell>
                            {record.earlyLeaveMinutes > 0 ? (
                              <span className="text-orange-600 dark:text-orange-400">{record.earlyLeaveMinutes}</span>
                            ) : 0}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clock In/Out Dialog */}
      <Dialog open={isClockDialogOpen} onOpenChange={setIsClockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Clock {clockAction === 'in' ? 'In' : 'Out'} - {selectedStaffForClock?.firstName} {selectedStaffForClock?.lastName}
            </DialogTitle>
            <DialogDescription>
              Record clock {clockAction} time for this staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <span className="font-medium">Current Time</span>
              </div>
              <p className="text-2xl font-bold">
                {new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={clockNotes}
                onChange={(e) => setClockNotes(e.target.value)}
                placeholder="Add any notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClockAction}>
              {clockAction === 'in' ? (
                <LogIn className="mr-2 h-4 w-4" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Confirm Clock {clockAction === 'in' ? 'In' : 'Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
