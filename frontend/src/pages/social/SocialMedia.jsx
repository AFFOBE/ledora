import { useApp } from '../../context/AppContext'
import SMPlans from './SMPlans'
import SMPayment from './SMPayment'
import SMDashboard from './SMDashboard'

export default function SocialMedia() {
  const { sm } = useApp()

  return (
    <section className="page active">
      {sm.socialStep === 'plans' && <SMPlans />}
      {sm.socialStep === 'form' && <SMPayment />}
      {sm.socialStep === 'dash' && <SMDashboard />}
    </section>
  )
}