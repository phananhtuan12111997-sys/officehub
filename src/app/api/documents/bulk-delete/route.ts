import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { folderIds, fileIds } = await req.json()

    if ((!folderIds || folderIds.length === 0) && (!fileIds || fileIds.length === 0)) {
      return NextResponse.json({ error: 'Danh sách ID không hợp lệ' }, { status: 400 })
    }

    // Check if the user is an admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const isAdmin = profile?.role === 'admin'

    // Process each item (can be folder or file)
    let foldersToProcess: any[] = []
    if (folderIds && folderIds.length > 0) {
      const { data } = await supabaseAdmin.from('document_folders').select('id, created_by').in('id', folderIds)
      if (data) foldersToProcess = data
    }
    
    let filesToProcess: any[] = []
    if (fileIds && fileIds.length > 0) {
      const { data } = await supabaseAdmin.from('documents').select('id, file_url, uploaded_by').in('id', fileIds)
      if (data) filesToProcess = data
    }

    let deletedCount = 0;

    // Delete Folders
    if (foldersToProcess && foldersToProcess.length > 0) {
      const folderIdsToDelete = isAdmin 
        ? foldersToProcess.map(f => f.id) 
        : foldersToProcess.filter(f => f.created_by === user.id).map(f => f.id)
      
      if (folderIdsToDelete.length > 0) {
        // Find all files inside these folders (or subfolders) to delete their physical files
        // Since we don't have nested folders anymore, we just find files where folder_id is in folderIdsToDelete
        const { data: filesInFolders } = await supabaseAdmin
          .from('documents')
          .select('id, file_url')
          .in('folder_id', folderIdsToDelete)
          
        if (filesInFolders && filesInFolders.length > 0) {
          const fileUrls = filesInFolders.map(f => f.file_url).filter(Boolean) as string[]
          if (fileUrls.length > 0) {
            const filePaths = fileUrls.map(url => {
              try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/documents/');
                return pathParts.length > 1 ? decodeURIComponent(pathParts[1]) : null;
              } catch (e) {
                return null;
              }
            }).filter(Boolean) as string[]
            if (filePaths.length > 0) {
              await supabaseAdmin.storage.from('documents').remove(filePaths)
            }
          }
        }

        // Delete the folders (cascade will delete DB records of files inside)
        await supabaseAdmin.from('document_folders').delete().in('id', folderIdsToDelete)
        deletedCount += folderIdsToDelete.length
      }
    }

    // Delete Files
    if (filesToProcess && filesToProcess.length > 0) {
      const filesToDelete = isAdmin 
        ? filesToProcess 
        : filesToProcess.filter(f => f.uploaded_by === user.id)
        
      if (filesToDelete.length > 0) {
        const fileUrls = filesToDelete.map(f => f.file_url).filter(Boolean) as string[]
        const fileIds = filesToDelete.map(f => f.id)
        
        if (fileUrls.length > 0) {
          const filePaths = fileUrls.map(url => {
            try {
              const urlObj = new URL(url);
              const pathParts = urlObj.pathname.split('/documents/');
              return pathParts.length > 1 ? decodeURIComponent(pathParts[1]) : null;
            } catch (e) {
              return null;
            }
          }).filter(Boolean) as string[]
          if (filePaths.length > 0) {
            await supabaseAdmin.storage.from('documents').remove(filePaths)
          }
        }
        
        await supabaseAdmin.from('documents').delete().in('id', fileIds)
        deletedCount += fileIds.length
      }
    }

    if (deletedCount === 0) {
      return NextResponse.json({ error: 'Không có mục nào được xóa (có thể do bạn không có quyền)' }, { status: 403 })
    }

    return NextResponse.json({ message: 'Xóa thành công', deletedCount })
  } catch (error: any) {
    console.error('Lỗi khi xóa nhiều mục:', error)
    return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 })
  }
}
