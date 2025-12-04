import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NavPill from './NavPill'

describe('NavPill', () => {
  it('opens the menu on hover and keeps it open when moving into the menu', async () => {
    render(<NavPill currentHref="/tracker" />)
    const button = screen.getByRole('button', { name: /tracker/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    // menu closed initially
    expect(dropdown).toHaveClass('pointer-events-none')

    await userEvent.hover(button)
    expect(dropdown).toHaveClass('pointer-events-auto')

    // move cursor into the dropdown and ensure it stays open
    await userEvent.hover(dropdown)
    expect(dropdown).toHaveClass('pointer-events-auto')
  })

  it('toggles open/close on click', async () => {
    render(<NavPill currentHref="/dashboard" />)
    const button = screen.getByRole('button', { name: /dashboard/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    await userEvent.click(button)
    expect(dropdown).toHaveClass('pointer-events-auto')

    await userEvent.click(button)
    expect(dropdown).toHaveClass('pointer-events-none')
  })
})
