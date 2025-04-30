import Activity from '@/components/activity'
import React, { Suspense } from 'react'

function page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Activity />
    </Suspense>
  )
}

export default page;