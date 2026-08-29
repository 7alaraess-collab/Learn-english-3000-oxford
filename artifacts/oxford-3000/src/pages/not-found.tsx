import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  const isArabic = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'} lang={isArabic ? 'ar' : 'en'}>
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {isArabic ? '404 الصفحة غير موجودة' : '404 Page Not Found'}
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {isArabic ? 'هل نسيت إضافة الصفحة إلى المسارات؟' : 'Did you forget to add the page to the router?'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
