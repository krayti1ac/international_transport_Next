'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage, User } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchMessages();
    getCurrentUser();

    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) {
        setCurrentUser({
          id: data.id,
          email: data.email || '',
          role: data.role,
          name: data.name || '',
          created_at: data.created_at,
        });
      }
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast({
        title: 'خطأ في تحميل المحادثات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: currentUser.id,
          message: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
      toast({
        title: 'خطأ في إرسال الرسالة',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري تحميل المحادثات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground">المحادثات الداخلية</h1>
        <p className="text-sm text-muted-foreground mt-0.5">التواصل الفوري والداخلي بين الإدارة والسائقين</p>
      </div>

      <Card className="h-[600px] flex flex-col shadow-md border-border">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="font-amiri flex items-center gap-2 text-foreground">
            <MessageSquare className="w-5 h-5 text-primary" />
            محادثة الفريق المباشرة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
          <div className="flex-1 overflow-y-auto space-y-3 p-2">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-foreground font-medium">لا توجد رسائل بعد</p>
                <p className="text-xs text-muted-foreground mt-1">ابدأ المحادثة مع فريق العمل الآن</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = currentUser && msg.sender_id === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwnMessage ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground rounded-br-xs'
                          : 'bg-muted/70 text-foreground border border-border rounded-bl-xs'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <p className={`text-[11px] mt-1 font-mono ${isOwnMessage ? 'text-blue-100 opacity-80' : 'text-muted-foreground'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-border">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim()} className="px-5">
              <Send className="w-4 h-4 ml-1.5" />
              إرسال
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
